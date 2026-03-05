# Design: Pre-Phase 2B Quality Gate

**Date:** 2026-03-05
**Status:** Approved
**Source:** Progress review findings (`docs/progress-reviews/pre-phase-2b-2026-03-05.md`)

---

## Overview

Address all gaps from the pre-Phase 2B progress review that don't depend on Phase 2B data (200+ live shops, search UI). This is a focused quality gate: DB indexes, test coverage, and one validation fix.

## Scope

### 1. DB Migration — Missing Indexes

Single migration file bundling 4 performance indexes:

| Index | Column(s) | Why |
|-------|-----------|-----|
| `idx_shop_reviews_shop` | `shop_reviews(shop_id)` | Prevents full-table scan on shop detail page |
| `idx_shops_processing_status` | `shops(processing_status)` | Speeds pipeline state queries (find pending/failed) |
| `idx_profiles_deletion_requested` | `profiles(deletion_requested_at) WHERE NOT NULL` | Speeds daily PDPA hard-delete scheduler |
| `idx_shops_source` | `shops(source)` | Speeds analytics and admin filtering by source |

All are additive — zero risk, no app code changes.

### 2. Frontend Tests — Auth Entry Points (4 page tests)

| Page | Test File | Key Scenarios |
|------|-----------|---------------|
| `/login` | `app/(auth)/login/page.test.tsx` | Email form submit, OAuth buttons (Google/LINE), error display, redirect after login |
| `/signup` | `app/(auth)/signup/page.test.tsx` | Signup form, PDPA checkbox required, email confirmation message, error display |
| `/onboarding/consent` | `app/onboarding/consent/page.test.tsx` | PDPA consent checkbox + submit, redirect to home, consent API call |
| `/account/recover` | `app/account/recover/page.test.tsx` | Cancel-deletion API call, success message, error state |

Test pattern: mock at boundaries (Supabase auth SDK, `fetch`), describe user actions, realistic data via factories.

### 3. Frontend Tests — SWR Hooks (3 hook tests)

| Hook | Test File | Key Scenarios |
|------|-----------|---------------|
| `useUserProfile` | `lib/hooks/use-user-profile.test.ts` | Fetch profile, null while loading, error state, mutate |
| `useUserCheckins` | `lib/hooks/use-user-checkins.test.ts` | Fetch check-ins, empty array while loading, error |
| `useListSummaries` | `lib/hooks/use-list-summaries.test.ts` | Fetch summaries, empty array while loading, error |

### 4. Backend Test — check_urls Handler

| Handler | Test File | Key Scenarios |
|---------|-----------|---------------|
| `check_urls.py` | `backend/tests/workers/test_check_urls.py` | Valid URL (200 OK), dead URL (404/timeout), batch processing, status updates |

### 5. Data Validation — confirmed_tags

Add taxonomy tag validation to `CheckInService.create()` and `update_review()`:
- Query `taxonomy_tags` IDs (cacheable — tags change rarely)
- Reject unknown tag IDs with HTTP 400: `"Unknown tag IDs: [tag1, tag2]"`
- Service-level only (no DB trigger or FK constraint — YAGNI for MVP)

## Out of Scope

- Search page tests (depends on Phase 2B search UI)
- DB-level confirmed_tags enforcement (service-level sufficient)
- Admin page tests (internal tool, acceptable without tests)
- E2E tests (per testing philosophy: "few" — 3-5 critical paths only, deferred to Phase 3)

## Verification

- All 8 new test files pass (7 frontend + 1 backend)
- DB migration applies cleanly (`supabase db diff` shows no drift after)
- `pnpm test`, `pytest`, `pnpm build`, `ruff`, `mypy` all green
- Existing tests unaffected (no regressions)
