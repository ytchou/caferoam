#!/usr/bin/env python3
"""
Test coverage enforcement script for CI/CD.
Parses pytest (XML) and Vitest/Jest (JSON) coverage reports, applies path-based rules,
and generates a unified markdown summary for PR comments.

CUSTOMIZATION POINTS (in coverage-rules.json):
  - stack_detection_paths: path fragments that identify which stack a file belongs to
  - display_prefix: prefix stripped from file paths in the PR comment (for readability)
  - critical_paths: exact file paths (relative) that require higher coverage
  - critical_patterns: glob patterns for critical files
  - critical_threshold / default_threshold: coverage percentages (blocking)
  - exclude_patterns: files to skip entirely (e.g. __init__.py, index.ts)

Thresholds are defined in coverage-rules.json — defaults are:
  - Critical files: 89% (blocking)
  - Non-critical files: 45% (blocking)
"""

import argparse
import fnmatch
import json
import os
import sys
import defusedxml.ElementTree as ET


def parse_pytest_coverage(xml_path: str) -> dict[str, dict[str, float]]:
    """
    Parse pytest coverage XML (Cobertura format).

    Returns:
        Dict mapping filepath to {covered, total, percentage}
    """
    if not os.path.exists(xml_path):
        return {}

    try:
        tree = ET.parse(xml_path)
        root = tree.getroot()

        file_coverage = {}
        for package in root.findall(".//package"):
            for cls in package.findall(".//class"):
                filename = cls.get("filename")
                if not filename:
                    continue

                lines = cls.findall(".//line")
                if not lines:
                    continue

                covered = len(
                    [line for line in lines if int(line.get("hits", "0")) > 0]
                )
                total = len(lines)
                coverage_pct = (covered / total * 100) if total > 0 else 0

                file_coverage[filename] = {
                    "covered": covered,
                    "total": total,
                    "percentage": round(coverage_pct, 1),
                }

        return file_coverage

    except ET.ParseError as e:
        print(f"Failed to parse backend coverage XML: {e}", file=sys.stderr)
        sys.exit(1)


def parse_vitest_coverage(json_path: str) -> dict[str, dict[str, float]]:
    """
    Parse Vitest/Jest coverage JSON (v8 format).

    Returns:
        Dict mapping filepath to {covered, total, percentage}
    """
    if not os.path.exists(json_path):
        return {}

    try:
        with open(json_path) as f:
            data = json.load(f)

        file_coverage = {}
        for filepath, file_data in data.items():
            if "s" not in file_data:
                continue

            statements = file_data["s"]
            covered = len([v for v in statements.values() if v > 0])
            total = len(statements)
            coverage_pct = (covered / total * 100) if total > 0 else 0

            file_coverage[filepath] = {
                "covered": covered,
                "total": total,
                "percentage": round(coverage_pct, 1),
            }

        return file_coverage

    except (json.JSONDecodeError, KeyError) as e:
        print(f"Failed to parse frontend coverage JSON: {e}", file=sys.stderr)
        sys.exit(1)


def detect_stack(filepath: str, rules: dict) -> str:
    """
    Detect which stack a file belongs to using stack_detection_paths from rules config.

    Each stack section in rules can have a "stack_detection_paths" list of path
    fragments. The first matching stack wins. Falls back to the first defined stack.
    """
    for stack_name, stack_rules in rules.items():
        if not isinstance(stack_rules, dict):
            continue
        detection_paths = stack_rules.get("stack_detection_paths", [])
        for path_fragment in detection_paths:
            if path_fragment in filepath:
                return stack_name

    # Fallback: return first available stack
    stacks = [k for k in rules if isinstance(rules[k], dict)]
    return stacks[0] if stacks else "backend"


def should_exclude_file(filepath: str, rules: dict) -> bool:
    """
    Check if file should be excluded from coverage checks.

    Uses stack_detection_paths from rules to determine which stack's
    exclude_patterns to apply.
    """
    stack = detect_stack(filepath, rules)
    if stack not in rules:
        return False

    exclude_patterns = rules[stack].get("exclude_patterns", [])
    for pattern in exclude_patterns:
        if fnmatch.fnmatch(filepath, pattern):
            return True
        filename = filepath.split("/")[-1]
        if fnmatch.fnmatch(filename, pattern):
            return True

    return False


def classify_file(filepath: str, rules: dict) -> tuple[str, int]:
    """
    Classify file as 'critical' or 'default' and return threshold.

    Uses stack_detection_paths from rules to determine which stack's
    critical_paths and critical_patterns to check.
    """
    stack = detect_stack(filepath, rules)
    if stack not in rules:
        return "default", 50

    stack_rules = rules[stack]

    critical_paths = stack_rules.get("critical_paths", [])
    for critical_path in critical_paths:
        if filepath.endswith("/" + critical_path) or filepath == critical_path:
            return "critical", stack_rules.get("critical_threshold", 90)

    critical_patterns = stack_rules.get("critical_patterns", [])
    for pattern in critical_patterns:
        if fnmatch.fnmatch(filepath, pattern):
            return "critical", stack_rules.get("critical_threshold", 90)

    return "default", stack_rules.get("default_threshold", 50)


def check_coverage(
    file_coverage: dict[str, dict[str, float]], rules: dict
) -> tuple[dict, int]:
    """
    Check coverage against rules and categorize results.

    Returns:
        Tuple of (results dict, exit_code)
    """
    results = {
        "critical_failures": [],
        "default_failures": [],
        "critical_passing": [],
        "default_passing": [],
    }

    for filepath, cov_data in file_coverage.items():
        if should_exclude_file(filepath, rules):
            continue

        classification, threshold = classify_file(filepath, rules)

        if cov_data["percentage"] < threshold:
            if classification == "critical":
                results["critical_failures"].append((filepath, cov_data, threshold))
            else:
                results["default_failures"].append((filepath, cov_data, threshold))
        else:
            if classification == "critical":
                results["critical_passing"].append((filepath, cov_data, threshold))
            else:
                results["default_passing"].append((filepath, cov_data, threshold))

    has_failures = (
        len(results["critical_failures"]) > 0 or len(results["default_failures"]) > 0
    )
    exit_code = 1 if has_failures else 0

    return results, exit_code


def shorten_path(filepath: str, rules: dict = None) -> str:
    """
    Shorten filepath for display using display_prefix from rules config.

    Each stack section can define a "display_prefix" string. When found in the
    filepath, everything up to and including the prefix is stripped.
    Falls back to stripping "app/" prefix for unlisted paths.
    """
    if rules:
        for stack_name, stack_rules in rules.items():
            if not isinstance(stack_rules, dict):
                continue
            prefix = stack_rules.get("display_prefix", "")
            if prefix and prefix in filepath:
                return filepath.split(prefix)[-1]

    # Fallback for paths not matched by rules
    if "app/" in filepath:
        return filepath.split("app/")[-1]
    return filepath


def generate_markdown_summary(
    results: dict,
    backend_coverage: dict[str, dict[str, float]],
    frontend_coverage: dict[str, dict[str, float]],
    rules: dict,
) -> str:
    """
    Generate concise markdown summary for PR comment.

    Shows:
    1. Summary of # files scanned (critical vs non-critical)
    2. Number of files failed threshold
    3. Table of files that fail (only failures, not all files)
    4. Overall coverage per stack (only for non-empty stacks)
    """
    critical_total = len(results["critical_failures"]) + len(
        results["critical_passing"]
    )
    critical_failed = len(results["critical_failures"])

    default_total = len(results["default_failures"]) + len(results["default_passing"])
    default_failed = len(results["default_failures"])

    total_failed = critical_failed + default_failed

    # Overall coverage per stack — only show non-empty stacks
    stack_summaries = []

    if backend_coverage:
        backend_total_lines = sum(f["total"] for f in backend_coverage.values())
        backend_covered_lines = sum(f["covered"] for f in backend_coverage.values())
        backend_pct = (
            (backend_covered_lines / backend_total_lines * 100)
            if backend_total_lines > 0
            else 0
        )
        stack_summaries.append(f"Backend {backend_pct:.1f}%")

    if frontend_coverage:
        frontend_total_lines = sum(f["total"] for f in frontend_coverage.values())
        frontend_covered_lines = sum(f["covered"] for f in frontend_coverage.values())
        frontend_pct = (
            (frontend_covered_lines / frontend_total_lines * 100)
            if frontend_total_lines > 0
            else 0
        )
        stack_summaries.append(f"Frontend {frontend_pct:.1f}%")

    has_failures = total_failed > 0
    status_icon = "BLOCKED" if has_failures else "PASSED"
    status_emoji = "&#x274C;" if has_failures else "&#x2705;"

    # Derive threshold labels from rules (use first stack's values as representative)
    first_stack = next((v for v in rules.values() if isinstance(v, dict)), {})
    critical_threshold = first_stack.get("critical_threshold", 89)
    default_threshold = first_stack.get("default_threshold", 45)

    lines = [
        "## Test Coverage Report",
        "",
        f"### {status_emoji} {status_icon}",
        "",
        "| Category | Scanned | Passed | Failed | Threshold |",
        "|----------|---------|--------|--------|-----------|",
        f"| Critical | {critical_total} | {critical_total - critical_failed} | {critical_failed} | {critical_threshold}% |",
        f"| Non-critical | {default_total} | {default_total - default_failed} | {default_failed} | {default_threshold}% |",
        "",
        f"**Overall:** {' | '.join(stack_summaries) if stack_summaries else 'No data'}",
        "",
    ]

    if has_failures:
        lines.append("---")
        lines.append("")
        lines.append("### Files Below Threshold")
        lines.append("")
        lines.append("| File | Coverage | Required | Type |")
        lines.append("|------|----------|----------|------|")

        for filepath, cov_data, threshold in sorted(
            results["critical_failures"], key=lambda x: x[1]["percentage"]
        ):
            short_path = shorten_path(filepath, rules)
            pct = cov_data["percentage"]
            lines.append(f"| `{short_path}` | {pct}% | {threshold}% | Critical |")

        for filepath, cov_data, threshold in sorted(
            results["default_failures"], key=lambda x: x[1]["percentage"]
        ):
            short_path = shorten_path(filepath, rules)
            pct = cov_data["percentage"]
            lines.append(f"| `{short_path}` | {pct}% | {threshold}% | Non-critical |")

        lines.append("")
        lines.append("---")
        lines.append("")
        lines.append(
            "**This PR is blocked.** All files must meet their coverage threshold."
        )
    else:
        lines.append("All files meet coverage thresholds.")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Check test coverage against rules")
    parser.add_argument(
        "--backend", help="Path to backend coverage XML file (Cobertura format)"
    )
    parser.add_argument(
        "--frontend", help="Path to frontend coverage JSON file (v8 format)"
    )
    parser.add_argument(
        "--rules", required=True, help="Path to coverage rules JSON file"
    )
    parser.add_argument(
        "--output", required=True, help="Path to output markdown summary file"
    )

    args = parser.parse_args()

    if not os.path.exists(args.rules):
        print(f"Rules file not found: {args.rules}", file=sys.stderr)
        sys.exit(1)

    with open(args.rules) as f:
        rules = json.load(f)

    print("Parsing coverage reports...")

    backend_coverage = {}
    if args.backend:
        print(f"  Backend: {args.backend}")
        backend_coverage = parse_pytest_coverage(args.backend)
        if backend_coverage:
            print(f"    Found {len(backend_coverage)} files")
        else:
            print("    No backend coverage data found")

    frontend_coverage = {}
    if args.frontend:
        print(f"  Frontend: {args.frontend}")
        frontend_coverage = parse_vitest_coverage(args.frontend)
        if frontend_coverage:
            print(f"    Found {len(frontend_coverage)} files")
        else:
            print("    No frontend coverage data found")

    if not backend_coverage and not frontend_coverage:
        print("No coverage data found. Tests may not have run.", file=sys.stderr)
        sys.exit(1)

    all_coverage = {**backend_coverage, **frontend_coverage}

    print(f"\nChecking {len(all_coverage)} files against coverage rules...")
    results, exit_code = check_coverage(all_coverage, rules)

    summary = generate_markdown_summary(
        results, backend_coverage, frontend_coverage, rules
    )

    with open(args.output, "w") as f:
        f.write(summary)

    print(f"\nCoverage summary written to {args.output}")

    critical_failed = len(results["critical_failures"])
    default_failed = len(results["default_failures"])

    if critical_failed:
        print(f"\n{critical_failed} critical file(s) below threshold:")
        for filepath, cov_data, _threshold in results["critical_failures"]:
            print(f"  - {shorten_path(filepath, rules)}: {cov_data['percentage']}%")

    if default_failed:
        print(f"\n{default_failed} non-critical file(s) below threshold:")
        for filepath, cov_data, _threshold in results["default_failures"]:
            print(f"  - {shorten_path(filepath, rules)}: {cov_data['percentage']}%")

    if not critical_failed and not default_failed:
        print("\nAll files meet coverage thresholds")

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
