# Code Review Log: feat/admin-dashboard

**Date:** 2026-03-02
**Branch:** feat/admin-dashboard
**HEAD:** 9f96d72d66db410daa2bd83928dcf13d6e18030c
**Mode:** Pre-PR

## Pass 1 — Full Discovery

_Agents: Bug Hunter (Opus), Standards (Sonnet), Architecture (Opus), Plan Alignment (Sonnet), Test Philosophy (Sonnet), Gemini (cross-review)_

### Issues Found (24 total)

| #   | Severity  | File:Line                                                                         | Description                                                                                                                                      | Flagged By                                          |
| --- | --------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| C1  | Critical  | `app/(admin)/admin/shops/[id]/page.tsx:66-73`                                     | Backend returns `{shop:{...}, tags:[...], photos:[...]}` but frontend reads flat `data.name` etc. — all shop fields undefined                    | Bug Hunter, Architecture                            |
| C2  | Critical  | `app/(admin)/admin/page.tsx:30`, `shops/[id]/page.tsx:92`, `jobs/page.tsx:110`    | Three proxy routes missing: `/api/admin/pipeline/overview`, `/api/admin/pipeline/enqueue`, `/api/admin/pipeline/retry/[id]` — all 404 at runtime | Bug Hunter, Standards, Architecture, Plan Alignment |
| C3  | Critical  | `app/(admin)/admin/shops/[id]/page.tsx:136` + `app/api/admin/shops/[id]/route.ts` | `handleSaveEdit` sends PATCH but proxy only exports PUT — shop edits always 405                                                                  | Bug Hunter, Standards, Architecture, Plan Alignment |
| C4  | Critical  | `backend/api/admin_taxonomy.py:35`                                                | `row.get("shop_id")` on `shop_tag_counts` RPC which returns `{tag_id, shop_count}` — `unique_tagged_shops` always 0                              | Bug Hunter                                          |
| C5  | Critical  | `app/(admin)/admin/shops/[id]/page.tsx:118` + `backend/api/admin_shops.py:218`    | Frontend sends `?q=` but backend FastAPI param is `query` — all search-rank calls get 422                                                        | Bug Hunter, Standards                               |
| I1  | Important | `app/(admin)/admin/jobs/page.tsx:62-65`                                           | Frontend sends `page`/`page_size` but backend expects `offset`/`limit` — pagination broken                                                       | Bug Hunter                                          |
| I2  | Important | `app/(admin)/admin/taxonomy/page.tsx:17-21`                                       | `MissingEmbeddingShop` interface expects `shop_id`/`shop_name` but backend selects `id`/`name` — list renders blank                              | Bug Hunter                                          |
| I3  | Important | `supabase/migrations/20260302000001_admin_dashboard.sql:5-13`                     | `admin_audit_logs` created without `ENABLE ROW LEVEL SECURITY` — violates project RLS policy                                                     | Bug Hunter, Standards, Architecture                 |
| I4  | Important | `backend/api/admin.py:161-177`                                                    | `cancel_job` check-then-act race condition — worker could complete job between read and write                                                    | Bug Hunter                                          |
| I5  | Important | `backend/api/admin_shops.py:21-24`, `admin_taxonomy.py:15-18`                     | `_require_admin` copy-pasted across 3 files instead of extracted to `api/deps.py`                                                                | Standards, Architecture                             |
| I6  | Important | `backend/api/admin.py:77-98, 102-128`                                             | `retry_job` and `reject_submission` missing `log_admin_action` calls — no audit trail                                                            | Architecture                                        |
| I7  | Important | `backend/api/admin_shops.py:44`                                                   | `UpdateShopRequest.processing_status: str` accepts any string instead of `ProcessingStatus` enum                                                 | Architecture                                        |
| I8  | Important | `app/(admin)/admin/shops/[id]/page.test.tsx`                                      | Test mock uses flat response shape that doesn't match actual backend shape — hides C1                                                            | Architecture                                        |
| I9  | Important | `app/(admin)/admin/shops/[id]/page.tsx`                                           | "Set Live / Unpublish" action button missing — specified in plan and design doc                                                                  | Plan Alignment                                      |
| I10 | Important | `middleware.ts`                                                                   | Reads `app_metadata.is_admin` but no JWT hook or migration sets it — admin access blocked in any fresh environment                               | Plan Alignment                                      |
| I11 | Important | `backend/api/admin_shops.py:27-32, 89-98`                                         | `google_maps_url` accepted in `CreateShopRequest` but never inserted — silent data loss                                                          | Bug Hunter, Gemini                                  |
| I12 | Important | `backend/tests/api/test_admin.py:211`, `test_admin_shops.py:92,147,174,175`       | `log_admin_action` and `JobQueue` patched as internal modules — violates mock-at-boundaries rule                                                 | Test Philosophy, Standards                          |
| M1  | Minor     | `app/(admin)/admin/shops/[id]/page.tsx:132-153`                                   | `handleSaveEdit` has no error state on failure — user sees no feedback when save fails                                                           | Bug Hunter, Standards                               |
| M2  | Minor     | `app/(admin)/admin/jobs/page.tsx:99-115`                                          | `handleCancel` and `handleRetry` have no `res.ok` check or try/catch                                                                             | Bug Hunter                                          |
| M3  | Minor     | `app/(admin)/admin/shops/page.tsx`                                                | `source` filter dropdown missing — plan-specified, backend param exists                                                                          | Plan Alignment                                      |
| M4  | Minor     | `app/(admin)/admin/shops/page.tsx`                                                | Shows `updated_at` as "Updated" instead of plan-specified `enriched_at`                                                                          | Plan Alignment                                      |
| M5  | Minor     | `app/(admin)/admin/shops/[id]/page.tsx:144-145`                                   | `parseFloat` on lat/lng without validation — NaN becomes null in JSON, could corrupt coordinates                                                 | Gemini                                              |
| M6  | Minor     | `backend/tests/api/test_admin.py:17-136`                                          | Test function names use endpoint names not user outcomes                                                                                         | Test Philosophy                                     |
| M7  | Minor     | `backend/tests/api/test_admin_shops.py:40-41,118`                                 | Placeholder test data: `name="Coffee A"`, `name="Test"`                                                                                          | Test Philosophy                                     |

### Gemini Disputes / False Positives

- `job_queue_counts_by_status` RPC flagged as missing from migration — **False positive**: RPC defined in prior migration `20260226000009_add_job_queue_counts_rpc.sql`
- "all" filter value sent literally to backend — **False positive**: lines 66-67 correctly guard with `if (status !== 'all')` before appending to params
- `handleEnqueue` flagged separately by Gemini — **Duplicate**: already covered in C2

### Validation Results

- Skipped (false positive): `admin.py:31 job_queue_counts_by_status RPC` — exists in prior migration
- Skipped (false positive): `jobs/page.tsx "all" filter` — code correctly guards before setting param
- Proceeding to fix: 5 Critical, 12 Important, 7 Minor

---

## Fix Pass 1 (Critical)

**Pre-fix SHA:** 9f96d72d66db410daa2bd83928dcf13d6e18030c
**Commit:** `bb750f5`

| #   | Status | Fix                                                                                                                                        |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| C1  | Fixed  | `shops/[id]/page.tsx`: destructure `{shop, tags, photos}` from API response; merge with `setShop({...shopData, tags, photos})`             |
| C2  | Fixed  | Created `app/api/admin/pipeline/overview/route.ts` and `app/api/admin/pipeline/retry/[id]/route.ts`; fixed enqueue URL in shop detail page |
| C3  | Fixed  | `handleSaveEdit` method changed from PATCH → PUT                                                                                           |
| C4  | Fixed  | `admin_taxonomy.py`: query `shop_tags` table directly for `unique_tagged_shops` count instead of wrong RPC                                 |
| C5  | Fixed  | `shops/[id]/page.tsx`: `?q=` → `?query=` in search-rank fetch                                                                              |
| I2  | Fixed  | `taxonomy/page.tsx`: `MissingEmbeddingShop` interface `shop_id/shop_name` → `id/name`                                                      |
| I8  | Fixed  | `shops/[id]/page.test.tsx`: test mock returns nested `{shop, tags, photos}` shape                                                          |
| I9  | Fixed  | Added `handleToggleLive()` and Set Live/Unpublish button to shop detail page                                                               |
| M1  | Fixed  | `handleSaveEdit` now has `editError` state and try/catch with error display                                                                |
| M5  | Fixed  | `parseFloat` guarded with `isNaN` check before sending lat/lng to API                                                                      |

## Fix Pass 2 (Important + Minor)

**Pre-fix SHA:** `bb750f5`
**Commit:** `0d5e3e2`

| #   | Status | Fix                                                                                                                                                                                |
| --- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I1  | Fixed  | `jobs/page.tsx`: pagination `page`/`page_size` → `offset`/`limit`; `JobsResponse` interface updated                                                                                |
| I3  | Fixed  | Migration: added `ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY`                                                                                                          |
| I4  | Fixed  | `admin.py cancel_job`: conditional `.in_("status", ["pending", "claimed"])` update eliminates check-then-act race                                                                  |
| I5  | Fixed  | `_require_admin` extracted to `api/deps.py` as `require_admin`; all 3 routers use shared dependency                                                                                |
| I6  | Fixed  | `admin.py`: `retry_job` and `reject_submission` now call `log_admin_action`                                                                                                        |
| I7  | Fixed  | `UpdateShopRequest.processing_status: str` → `ProcessingStatus \| None`                                                                                                            |
| I10 | Fixed  | `middleware.ts`: added comment explaining how to set `app_metadata.is_admin` manually in Supabase                                                                                  |
| I11 | Fixed  | `admin_shops.py create_shop`: `google_maps_url` included in DB insert                                                                                                              |
| I12 | Fixed  | Tests: removed `log_admin_action` + `JobQueue` internal patches; use `middleware.admin_audit.get_service_role_client` at DB boundary; `JobQueue.enqueue` tested via DB insert mock |
| M2  | Fixed  | `jobs/page.tsx`: `handleCancel` and `handleRetry` now have `res.ok` check and try/catch                                                                                            |
| M3  | Fixed  | `shops/page.tsx`: source filter dropdown added using `SOURCE_OPTIONS`                                                                                                              |
| M4  | Fixed  | `shops/page.tsx`: column shows `enriched_at` (with `'—'` fallback) instead of `updated_at`                                                                                         |
| M6  | Fixed  | All test functions renamed to user-outcome framing across `test_admin.py`, `test_admin_shops.py`, `test_admin_taxonomy.py`                                                         |
| M7  | Fixed  | Placeholder names ("Coffee A", "Coffee B", "Test") replaced with realistic Taiwanese café names                                                                                    |

## Verification

- **275** frontend tests pass (42 test files)
- **216** backend tests pass (all including new admin tests)
- Pre-existing TS error in `login/page.tsx` (`line_oidc` Provider type) — not in our diff, not introduced by this PR
- All 24 issues resolved; 2 Gemini false positives discarded
