# Code Review Log: feat/pre-phase2b-quality-gate

**Date:** 2026-03-05
**Branch:** feat/pre-phase2b-quality-gate
**Mode:** Pre-PR

## Pass 1 — Full Discovery

*Agents: Bug Hunter (Opus), Standards (Sonnet), Architecture (Opus), Plan Alignment (Sonnet), Test Philosophy (Sonnet)*

### Issues Found (11 total, 1 false positive skipped)

| Severity | File:Line | Description | Flagged By |
|----------|-----------|-------------|------------|
| Important | checkin_service.py:56,80-84 | Silent data loss: confirmed_tags validated but dropped when stars is None | Bug Hunter, Architecture, Standards |
| Important | check_urls.py:84-101 | Misleading stats when DB batch write fails (passed+failed < checked) | Bug Hunter, Architecture |
| Important | test_checkins.py | API tests mock deep Supabase chain instead of service boundary | Standards |
| Important | TODO.md:630-661 | All checkboxes still unchecked despite work being complete | Plan Alignment |
| Minor | test_checkins.py:44-80 | API test doesn't mock count query — is_first_checkin_at_shop untested | Bug Hunter |
| Minor | test_checkin_service.py:10-28 | _make_table_router order-coupled to implementation | Bug Hunter |
| Minor | hook test files | global.fetch mock not restored after tests | Bug Hunter |
| Minor | test_checkin_service.py, test_checkins.py | Inconsistent test data realism | Standards, Test Philosophy |
| Minor | use-list-summaries, use-user-checkins | Two SWR hook tests lack error-path coverage | Architecture |
| Minor | 3 hook test files | Test names describe endpoints, not user outcomes | Test Philosophy |
| Minor | design doc | Uses wrong route group path (public vs auth) | Plan Alignment |

### Validation Results

- Skipped (false positive): `test_checkins.py` — Supabase client IS the database boundary per testing philosophy. Current mocking approach is correct.
- Skipped (debatable, not worth churn): `_make_table_router` order coupling — this is inherent to mocking DB clients and is documented in the helper's docstring.
- Proceeding to fix: 9 valid/debatable issues
