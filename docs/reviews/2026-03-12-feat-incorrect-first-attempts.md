# Code Review Log: feat/incorrect-first-attempts

**Date:** 2026-03-12
**Branch:** feat/incorrect-first-attempts
**Mode:** Pre-PR
**HEAD SHA:** a9803c582df693295c5831680690d01e3e15e4af

## Pass 1 — Full Discovery

_Agents: Bug Hunter (Opus), Standards (Sonnet), Architecture (Opus), Plan Alignment (Sonnet)_

### Issues Found (14 raw, 2 valid after dedup + validation)

| Severity  | File:Line                | Description                                                                                                 | Flagged By   | Validation |
| --------- | ------------------------ | ----------------------------------------------------------------------------------------------------------- | ------------ | ---------- |
| Important | scripts/hooks/pre-commit | No hook installation mechanism — script exists but nothing sets `core.hooksPath` or copies to `.git/hooks/` | Architecture | Valid      |
| Important | CLAUDE.md:142-148        | File Ownership table references `src/components/` and `src/hooks/` which don't exist in this project        | Architecture | Valid      |

### Validation Results — Skipped (false positives / out of scope)

- `scripts/hooks/pre-commit:8` — Detached HEAD bypasses Guard 1: Not a real concern. Detached HEAD ≠ main branch. The hook's purpose is preventing commits to main/master specifically.
- `scripts/hooks/pre-commit:40` — Guard 3 regex matches comments/strings: Known tradeoff, already documented in code comment. `^\+` prefix limits scope. Occasional false positives acceptable for pre-commit guard.
- `scripts/hooks/pre-commit:23` — `.data[0]` pattern narrower than CLAUDE.md rule: Intentional narrowing. Catching all `[0]` would produce too many false positives (array destructuring, tuple access, etc.).
- `scripts/hooks/pre-commit:56` — `pnpm run lint` gives no contextual error under `set -e`: False positive. pnpm shows its own error output. `set -e` ensures script exits on failure.
- `docs/patterns/supabase-py.md:20-26` — `get_admin_db` shown with `Depends()` but codebase uses differently: False positive. Pattern doc matches actual usage in `backend/api/auth.py` and `backend/api/shops.py`.
- `scripts/hooks/pre-commit:37` — Missing `--diff-filter=AM` on name-only query: Harmless. Subsequent grep only matches added lines (`^\+`), so deleted files can't trigger false positive.
- `scripts/hooks/pre-commit` — No Python (`ruff`) linting in hook: Out of scope. Hook is intentionally frontend-focused. Python linting belongs in CI.
- Plan deviations (lint-staged → pnpm lint, SQL keywords removed): Intentional improvements during /simplify phase.
- Pattern doc staleness risk: General concern, not a specific actionable issue.
- Worktree path format inconsistency: Paths match across documents.

### Proceeding to fix: 2 valid issues

## Fix Pass 1

**Pre-fix SHA:** a9803c582df693295c5831680690d01e3e15e4af
**Commit:** 2b143b9

**Issues fixed:**

- [Important] package.json — Added `"prepare": "git config core.hooksPath scripts/hooks"` so hooks auto-install after `pnpm install`
- [Important] CLAUDE.md:127-128 — Fixed File Ownership paths: `src/components/` → `components/`, `src/hooks/` → `lib/hooks/`

**Batch Test Run:**

- `pnpm run lint` — PASS (1 pre-existing warning)
- `pnpm test` — PASS (73 files, 461 tests)

## Final State

**Iterations completed:** 1
**All Critical/Important resolved:** Yes
**Remaining issues:** None

**Review log:** docs/reviews/2026-03-12-feat-incorrect-first-attempts.md
