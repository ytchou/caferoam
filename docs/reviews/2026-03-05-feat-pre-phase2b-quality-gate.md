# Code Review Log: feat/pre-phase2b-quality-gate

**Date:** 2026-03-05
**Branch:** feat/pre-phase2b-quality-gate
**Mode:** Pre-PR

## Pass 1 — Full Discovery

_Agents: Bug Hunter (Opus), Standards (Sonnet), Architecture (Opus), Plan Alignment (Sonnet), Test Philosophy (Sonnet)_

### Issues Found (11 total)

| Severity  | File:Line                                 | Description                                                               | Flagged By                          |
| --------- | ----------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------- |
| Important | checkin_service.py:56,80-84               | Silent data loss: confirmed_tags validated but dropped when stars is None | Bug Hunter, Architecture, Standards |
| Important | check_urls.py:84-101                      | Misleading stats when DB batch write fails (passed+failed < checked)      | Bug Hunter, Architecture            |
| Important | test_checkins.py                          | API tests mock deep Supabase chain instead of service boundary            | Standards                           |
| Important | TODO.md:630-661                           | All checkboxes still unchecked despite work being complete                | Plan Alignment                      |
| Minor     | test_checkins.py:44-80                    | API test doesn't mock count query — is_first_checkin_at_shop untested     | Bug Hunter                          |
| Minor     | test_checkin_service.py:10-28             | \_make_table_router order-coupled to implementation                       | Bug Hunter                          |
| Minor     | hook test files                           | global.fetch mock not restored after tests                                | Bug Hunter                          |
| Minor     | test_checkin_service.py, test_checkins.py | Inconsistent test data realism                                            | Standards, Test Philosophy          |
| Minor     | use-list-summaries, use-user-checkins     | Two SWR hook tests lack error-path coverage                               | Architecture                        |
| Minor     | 3 hook test files                         | Test names describe endpoints, not user outcomes                          | Test Philosophy                     |
| Minor     | design doc                                | Uses wrong route group path (public vs auth)                              | Plan Alignment                      |

### Validation Results

- Skipped (false positive): `test_checkins.py` mocking depth — Supabase client IS the database boundary per testing philosophy. Current approach is correct.
- Skipped (debatable, low value): `_make_table_router` order coupling — inherent to DB client mocking, documented in helper docstring.
- Skipped (minor, low risk): `global.fetch` mock restoration — Vitest isolates module scope between test files.
- Skipped (minor, pre-existing): Inconsistent test data realism in `test_checkins.py` — these tests predate this branch.
- Skipped (minor, pre-existing): `is_first_checkin_at_shop` API-level test coverage gap — predates this branch.
- Proceeding to fix: 6 issues (2 Important + 4 Minor)

## Fix Pass 1

**Pre-fix SHA:** f814b4f1806e1c4110d131f7820bc5d04d1ce262

**Issues fixed:**

- [Important] checkin_service.py:52-53 — Added `confirmed_tags requires a star rating` validation guard
- [Important] check_urls.py:66,95,101,123 — Added `errored` counter for DB batch write failures
- [Important] TODO.md:630-661 — Checked off all 16 completed items
- [Minor] 3 hook test files — Renamed test descriptions from endpoint-focused to user-journey framing
- [Minor] use-list-summaries, use-user-checkins — Added error-path test coverage (matching use-user-profile)
- [Minor] design doc — Fixed route group path `(public)` → `(auth)`
- [Minor] test_checkin_service.py — Added test for confirmed_tags-without-stars validation

**Issues skipped (false positives / low value):**

- test_checkins.py deep mocking — Supabase IS the boundary
- \_make_table_router coupling — inherent to mock pattern, documented
- global.fetch restoration — Vitest worker isolation makes this safe
- Inconsistent test data — pre-existing, not introduced by this branch
- is_first_checkin_at_shop gap — pre-existing

**Batch Test Run:**

- `pnpm test` — 461 passed
- `pytest` — 341 passed (1 failure from errored counter addition → fixed in bc1109a)

## Final State

**Iterations completed:** 1
**All Critical/Important resolved:** Yes
**Remaining issues:** None blocking. 3 minor pre-existing issues noted but not in scope.

**Review log:** docs/reviews/2026-03-05-feat-pre-phase2b-quality-gate.md
