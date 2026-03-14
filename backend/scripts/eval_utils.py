"""Shared utilities for evaluation scripts.

Provides output directory management, JSON persistence, and console
formatting helpers (colored threshold lines, ASCII tables).
"""

from __future__ import annotations

import json
import sys
from datetime import date
from pathlib import Path
from typing import Any

_SCRIPT_DIR = Path(__file__).parent
_DEFAULT_OUTPUT_BASE = _SCRIPT_DIR / "eval_outputs"

# ANSI color codes
_GREEN = "\033[32m"
_RED = "\033[31m"
_YELLOW = "\033[33m"
_RESET = "\033[0m"


def get_output_dir(script_name: str, base: Path | None = None) -> Path:
    """Return (and create) eval_outputs/YYYY-MM-DD/ directory."""
    root = base or _DEFAULT_OUTPUT_BASE
    today = date.today().isoformat()
    out = root / today
    out.mkdir(parents=True, exist_ok=True)
    return out


def save_results(data: dict[str, Any], script_name: str, base: Path | None = None) -> Path:
    """Write data as indented JSON; return the file path."""
    out_dir = get_output_dir(script_name, base)
    path = out_dir / f"{script_name}.json"
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
    return path


def print_threshold(name: str, target: float | bool, actual: float | bool, pass_bool: bool) -> None:
    """Print a single threshold result line with color."""
    icon = f"{_GREEN}✓{_RESET}" if pass_bool else f"{_RED}✗{_RESET}"
    color = _GREEN if pass_bool else _RED
    if isinstance(target, bool):
        target_str = str(target)
        actual_str = str(actual)
    else:
        target_str = f"{target}"
        actual_str = f"{actual:.1f}" if isinstance(actual, float) else str(actual)
    print(f"  {icon}  {name:<40}  target={target_str:<8}  actual={color}{actual_str}{_RESET}")


def print_table(rows: list[list[Any]], headers: list[str], col_width: int = 20) -> None:
    """Print a simple ASCII table."""
    widths = [max(col_width, len(h)) for h in headers]
    for row in rows:
        for i, cell in enumerate(row):
            widths[i] = max(widths[i], len(str(cell)))

    sep = "  ".join("-" * w for w in widths)
    header_line = "  ".join(h.ljust(w) for h, w in zip(headers, widths, strict=False))
    print(f"  {header_line}")
    print(f"  {sep}")
    for row in rows:
        line = "  ".join(str(cell).ljust(w) for cell, w in zip(row, widths, strict=False))
        print(f"  {line}")


def warn(msg: str) -> None:
    print(f"  {_YELLOW}⚠{_RESET}  {msg}", file=sys.stderr)
