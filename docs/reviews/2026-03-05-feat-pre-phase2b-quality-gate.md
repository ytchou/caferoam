# Code Review Log: feat/pre-phase2b-quality-gate

**Date:** 2026-03-05
**Branch:** feat/pre-phase2b-quality-gate
**Mode:** Post-PR (#23)
**HEAD SHA:** 66403e61bea74b168ab775431c2e401c0619fe2a

## Pass 1 (Pre-PR) — Prior Session

_See git history for details. Fixed: confirmed_tags data loss, errored counter, TODO.md checkboxes, hook test names, error-path coverage, design doc route path._

## Pass 2 (Post-PR) — Full Discovery

_Agents: Bug Hunter (Opus), Standards (Sonnet), Architecture (Opus), Plan Alignment (Sonnet), Test Philosophy (Sonnet)_

### Issues Found (11 total)

| #   | Severity  | File:Line                                                | Description                                                                                                                      | Flagged By               |
| --- | --------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| 1   | Important | `backend/api/checkins.py:85-86`                          | `update_review` maps ALL ValueError to 403 — validation errors (unknown tags) should be 400, only ownership errors should be 403 | Bug Hunter               |
| 2   | Important | `backend/workers/handlers/check_urls.py:119-126`         | `errored` counter not included in final completion log — operators see discrepancy                                               | Bug Hunter, Architecture |
| 3   | Important | `backend/tests/services/test_checkin_service.py:87-88`   | Tests assert which internal DB tables are called (implementation coupling)                                                       | Standards                |
| 4   | Important | `backend/tests/services/test_checkin_service.py:218,260` | Patching datetime module is mocking an internal, not a boundary                                                                  | Standards                |
| 5   | Important | `backend/tests/api/test_checkins.py:41-74`               | Test bypasses is_first_checkin via MagicMock auto-vivification                                                                   | Architecture             |
| 6   | Important | `TODO.md:657-659`                                        | Verification items unchecked                                                                                                     | Plan Alignment           |
| 7   | Minor     | `backend/tests/services/test_checkin_service.py:53,90`   | Test names describe functions not user actions                                                                                   | Standards                |
| 8   | Minor     | `backend/tests/services/test_checkin_service.py:10-28`   | `_make_table_router` uses call-order routing                                                                                     | Bug Hunter               |
| 9   | Minor     | `backend/workers/handlers/check_urls.py:75,84`           | Shops without URL silently filtered as dead                                                                                      | Bug Hunter               |
| 10  | Minor     | Hook test files (3)                                      | Placeholder 'test-token' instead of makeSession() factory                                                                        | Test Philosophy          |
| 11  | Minor     | Hook test files (3)                                      | describe blocks named after function, not user scenario                                                                          | Test Philosophy          |

### Validation Results

- Skipped (incorrect): #3 — Tests intentionally verify trigger migration completeness; table-call assertion IS the subject under test
- Skipped (incorrect): #4 — Time IS a system boundary (external state that changes between runs); CLAUDE.md "mock at system edges" includes time
- Skipped (incorrect): #5 — Test doesn't claim to test is_first_checkin; MagicMock auto-vivification is standard for unrelated paths
- Skipped (minor): #7, #8, #9, #11 — Low impact, would require invasive refactoring for cosmetic improvement
- Proceeding to fix: 4 issues (#1, #2, #6, #10)

## Fix Pass 1 (Prior Session)

**Pre-fix SHA:** 5ec786e00e10c28deef151389655ecd2222ff50b

**Issues fixed:**

- [Important] `backend/api/checkins.py:85-86` — Split ValueError handling: "Check-in not found" → 403, all other validation errors → 400
- [Important] `backend/workers/handlers/check_urls.py:119-126` — Added `errored=total_errored` to completion log
- [Important] `TODO.md:657-659` — Checked off all 3 verification items
- [Minor] Hook test files (3) — Replaced placeholder `'test-token'` with `makeSession()` factory
- Added regression test: `test_update_review_with_unknown_tags_returns_400`

## Pass 3 — Re-Discovery (Session 2)

_Agents: Bug Hunter (prior findings), Standards (prior findings), Architecture (prior findings), Plan Alignment (Sonnet), Test Philosophy (Sonnet)_

### New/Refined Issues Found

| #   | Severity  | File:Line                                | Description                                                                                   | Flagged By                          |
| --- | --------- | ---------------------------------------- | --------------------------------------------------------------------------------------------- | ----------------------------------- |
| 12  | Important | `backend/api/checkins.py:85-89`          | String matching on ValueError message for control flow — fragile, should use typed exceptions | Bug Hunter, Standards, Architecture |
| 13  | Important | `backend/api/checkins.py:88`             | 403 for not-found/not-owned check-in is wrong HTTP semantics — should be 404                  | Bug Hunter, Standards               |
| 14  | Minor     | `backend/services/checkin_service.py:45` | `len(photo_urls) < 1` should be `not photo_urls` (Python convention)                          | Standards                           |

### Validation Results (Pass 3)

- Skipped (false positive): "errored counter not logged" — Already logged at `check_urls.py:121-127`
- Skipped (out of scope): Deep Supabase chain mocking — DB client IS the boundary; repository layer refactor out of scope
- Skipped (out of scope): Implementation coupling in test assertions — assertions verify trigger migration intent
- Skipped (out of scope): Mypy ignore_errors breadth — pre-existing debt, narrowing is a separate task
- Skipped (out of scope): Backend mutation continue-on-error — mutmut bug workaround, documented
- Skipped (out of scope): Scope creep findings — CI/mutation infra supports PR's quality gate purpose
- Proceeding to fix: 3 issues (#12, #13, #14)

## Fix Pass 2

**Pre-fix SHA:** 7a0a2af57f29ce70795233aeac7f7644a48af11f

**Issues fixed:**

- [Important] #12+#13 — Created `core.exceptions.NotFoundError`; service raises `NotFoundError` instead of `ValueError`; API catches `NotFoundError → 404`, `ValueError → 400`. Eliminates string matching.
- [Minor] #14 — Changed `len(photo_urls) < 1` to `not photo_urls`
- Updated service test to expect `NotFoundError`
- Updated API tests to expect 404 instead of 403

**Batch Test Run:**

- `pnpm test` — 461 passed (73 files)
- `pytest` — 342 passed

## Final State

**Iterations completed:** 2 (across 2 sessions)
**All Critical/Important resolved:** Yes
**Remaining issues:** Minor items from Pass 2 (#7, #8, #9, #11) — cosmetic, not blocking

**Review log:** docs/reviews/2026-03-05-feat-pre-phase2b-quality-gate.md
