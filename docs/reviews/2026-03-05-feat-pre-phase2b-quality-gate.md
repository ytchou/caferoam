# Code Review Log: feat/pre-phase2b-quality-gate

**Date:** 2026-03-05
**Branch:** feat/pre-phase2b-quality-gate
**Mode:** Post-PR (#23)
**HEAD SHA:** 66403e61bea74b168ab775431c2e401c0619fe2a

## Pass 1 (Pre-PR) — Prior Session

*See git history for details. Fixed: confirmed_tags data loss, errored counter, TODO.md checkboxes, hook test names, error-path coverage, design doc route path.*

## Pass 2 (Post-PR) — Full Discovery

*Agents: Bug Hunter (Opus), Standards (Sonnet), Architecture (Opus), Plan Alignment (Sonnet), Test Philosophy (Sonnet)*

### Issues Found (11 total)

| # | Severity | File:Line | Description | Flagged By |
|---|----------|-----------|-------------|------------|
| 1 | Important | `backend/api/checkins.py:85-86` | `update_review` maps ALL ValueError to 403 — validation errors (unknown tags) should be 400, only ownership errors should be 403 | Bug Hunter |
| 2 | Important | `backend/workers/handlers/check_urls.py:119-126` | `errored` counter not included in final completion log — operators see discrepancy | Bug Hunter, Architecture |
| 3 | Important | `backend/tests/services/test_checkin_service.py:87-88` | Tests assert which internal DB tables are called (implementation coupling) | Standards |
| 4 | Important | `backend/tests/services/test_checkin_service.py:218,260` | Patching datetime module is mocking an internal, not a boundary | Standards |
| 5 | Important | `backend/tests/api/test_checkins.py:41-74` | Test bypasses is_first_checkin via MagicMock auto-vivification | Architecture |
| 6 | Important | `TODO.md:657-659` | Verification items unchecked | Plan Alignment |
| 7 | Minor | `backend/tests/services/test_checkin_service.py:53,90` | Test names describe functions not user actions | Standards |
| 8 | Minor | `backend/tests/services/test_checkin_service.py:10-28` | `_make_table_router` uses call-order routing | Bug Hunter |
| 9 | Minor | `backend/workers/handlers/check_urls.py:75,84` | Shops without URL silently filtered as dead | Bug Hunter |
| 10 | Minor | Hook test files (3) | Placeholder 'test-token' instead of makeSession() factory | Test Philosophy |
| 11 | Minor | Hook test files (3) | describe blocks named after function, not user scenario | Test Philosophy |

### Validation Results

- Skipped (incorrect): #3 — Tests intentionally verify trigger migration completeness; table-call assertion IS the subject under test
- Skipped (incorrect): #4 — Time IS a system boundary (external state that changes between runs); CLAUDE.md "mock at system edges" includes time
- Skipped (incorrect): #5 — Test doesn't claim to test is_first_checkin; MagicMock auto-vivification is standard for unrelated paths
- Skipped (minor): #7, #8, #9, #11 — Low impact, would require invasive refactoring for cosmetic improvement
- Proceeding to fix: 4 issues (#1, #2, #6, #10)
