# Code Review Log: feat/batch-scraping

**Date:** 2026-03-04
**Branch:** feat/batch-scraping
**Mode:** Pre-PR

## Pass 1 — Full Discovery

*Agents: Bug Hunter (Opus), Standards (Sonnet), Architecture (Sonnet), Plan Alignment (Sonnet)*

### Issues Found (11 total, 1 false positive skipped)

| Severity | File:Line | Description | Flagged By |
|----------|-----------|-------------|------------|
| Critical | `backend/api/admin.py:369` | `get_batch_detail` silently drops errors for failed `scrape_batch` jobs — `payload.get("shop_id", "")` returns `""` for batch-format payloads (which have `shops[]`, not `shop_id`) | Bug Hunter, Architecture |
| Important | `backend/workers/handlers/scrape_shop.py:8` | `_persist_scraped_data` is a private function (`_` prefix) imported across module boundary by `scrape_batch.py` — violates Python convention | Standards, Architecture |
| Important | `backend/workers/handlers/scrape_shop.py:53` | Shop can get stuck at "enriching" in the single-shop path — no try/except wraps `_persist_scraped_data` in `handle_scrape_shop`, so a review insert failure leaves shop at "enriching" with no status reset | Bug Hunter, Architecture |
| Important | `backend/api/admin.py:299-302` | `_collect_shop_ids_for_batch` can return duplicate shop IDs if multiple `scrape_batch` jobs share a `batch_id` (retry scenario) | Bug Hunter |
| Important | `backend/api/admin_shops.py:294` | TOCTOU: `approved = len(eligible_ids)` counts shops from SELECT, not actual UPDATE affected rows — another process could change status between SELECT and UPDATE | Bug Hunter |
| Important | `backend/providers/scraper/apify_adapter.py:47` | Duplicate URLs in batch input silently overwrite the `url_to_shop_id` dict — last shop wins, first loses result matching | Bug Hunter |
| Important | `backend/api/admin.py:217-223` | `list_batches` fetches ALL `scrape_shop`/`scrape_batch` jobs with no DB-level limit — degrades to full table scan at 10k+ jobs | Architecture |
| Important | `backend/workers/handlers/scrape_batch.py` | Zero test coverage for `handle_scrape_batch` — entire batch worker is untested | Architecture |
| Minor | `app/(admin)/admin/jobs/_components/BatchDetail.tsx:73-75` | Separate `statusFilter` effect sets `page=1` then triggers the fetch effect — redundant render cycle (AbortController mitigates data correctness issue) | Bug Hunter |
| Minor | `backend/tests/api/test_admin_shops_import.py:246-298` | Test data uses placeholder IDs (`"shop-1"`, `"job-1"`) instead of realistic UUIDs — violates CLAUDE.md realistic test data requirement | Standards |
| Minor | `backend/tests/api/test_admin_shops_import.py:258-265` | Bulk-approve tests verify HTTP status only, not that the enqueued job has correct `job_type`/payload shape | Architecture |

### Validation Results
- Skipped (false positive): `backend/workers/handlers/scrape_batch.py` — "No validation/logging for non-existent shop IDs before batch UPDATE" — silent skip on non-existent IDs is correct DB behavior; pre-validation would be TOCTOU-prone
- Proceeding to fix: 11 valid issues (1 Critical, 7 Important, 3 Minor)
