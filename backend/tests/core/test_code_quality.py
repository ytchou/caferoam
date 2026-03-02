"""Code quality guard: prevent re-introduction of bare .data[0] in production code.

Any new .data[0] access in backend production code (outside tests/) will fail this
test. Use first(response.data, "context") from core.db instead.

To exempt a line that is genuinely safe (e.g. an external API contract guarantees
a non-empty response), add an inline comment: # safe: <reason>
"""

import re
from pathlib import Path

_BACKEND_ROOT = Path(__file__).parent.parent.parent
_PATTERN = re.compile(r"\.data\[0\]")


def test_no_bare_data_index_zero_in_production_code() -> None:
    violations: list[str] = []

    for path in sorted(_BACKEND_ROOT.rglob("*.py")):
        if "tests/" in path.parts or path.name.startswith("test_"):
            continue
        text = path.read_text(encoding="utf-8")
        for lineno, line in enumerate(text.splitlines(), 1):
            if _PATTERN.search(line) and "# safe:" not in line:
                rel = path.relative_to(_BACKEND_ROOT)
                violations.append(f"  {rel}:{lineno}  {line.strip()}")

    assert not violations, (
        "Found bare .data[0] in production code — use first(response.data, 'context') instead:\n"
        + "\n".join(violations)
    )
