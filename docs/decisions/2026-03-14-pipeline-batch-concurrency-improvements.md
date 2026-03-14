# ADR: Pipeline Batch Scraping + Concurrent Enrichment

**Date:** 2026-03-14
**Status:** Accepted
**Context:** Initial pipeline test processing 10 shops sequentially took ~10 minutes. At that rate, processing the full 710-shop backlog would take ~12 hours. Two independent bottlenecks were identified and fixed.

## Decisions

### 1. Batch scraping via single Apify actor run

**Before:** Each `SCRAPE_SHOP` job triggered a separate Apify actor run — one cold start (~30s) per shop, all sequential.

**After:** `SCRAPE_BATCH` sends all URLs in one actor run. Apify crawls them concurrently internally. One cold start for N shops.

| N shops | Before | After |
|---------|--------|-------|
| 10 | ~7.5 min scraping | ~1 min |
| 15 | ~11 min scraping | ~54s |
| 100 | ~75 min scraping | ~4–5 min (estimated) |

The `scrape_batch` handler and `SCRAPE_BATCH` job type already existed. The `run_pipeline_batch.py` script was previously calling `handle_scrape_shop` per-shop — corrected to use `handle_scrape_batch`.

### 2. Concurrent enrichment (asyncio + semaphore)

**Before:** Enrich → embed → publish ran sequentially per shop. With Claude averaging ~20s/shop, 10 shops = ~200s.

**After:** All Taiwan shops start the enrich/embed/publish chain concurrently, bounded by `asyncio.Semaphore(settings.worker_concurrency_enrich)` (default: 5).

| N shops | Before | After |
|---------|--------|-------|
| 10 | ~200s enrich | ~40s (`ceil(10/5) × 20s`) |
| 15 | ~300s enrich | ~60s (`ceil(10/5) × 20s`, 10 Taiwan) |

Theoretical ceiling: `ceil(taiwan_count / concurrency) × avg_enrich_time`.

### 3. Geo-filter at persist boundary (no wasted API spend)

Non-Taiwan shops cannot be detected before scraping — the country is only known after Apify returns the address. The earliest possible rejection point is `persist_scraped_data`, shared by both single and batch scrape handlers.

**Changes:**
- `ScrapedShopData` now carries `country_code` (mapped from Apify's `countryCode` field)
- `persist_scraped_data` checks `country_code == "TW"` (fallback: `"台灣" in address`) before writing reviews, photos, or enqueuing enrichment
- Non-Taiwan shops get `processing_status = "out_of_region"` + `rejection_reason` stored on the shop record
- Zero Claude or OpenAI API spend on out-of-region shops

**Observed rejection rate:** ~20–33% of shops in the personal Google Takeout export are non-Taiwan (SF, Tokyo, NYC, Prague).

### 4. Batch run tracking in DB

Each script invocation creates a `batch_runs` record and a `batch_run_shops` row per shop, capturing:
- Per-shop status and elapsed time for each pipeline stage
- `rejection_reason` for out-of-region shops
- Aggregate counts (taiwan, out_of_region, not_found, live, errors)

This is the data source for the future admin dashboard pipeline view.

## Measured results (2026-03-14)

| Batch | Shops | Taiwan | OOR | Wall time | vs. before |
|-------|-------|--------|-----|-----------|------------|
| Batch 2 (before fix) | 15 | 12 | 3 | 8m 00s | baseline |
| Batch 3 (after fix)  | 15 | 10 | 5 | **1m 45s** | **4.6×** |

## Consequences

- **Positive:** Batch of 15 goes from 8 min → 1m45s. Full 710-shop backlog now estimated at ~35 min (10 batches of ~70 shops) vs. ~12 hours
- **Positive:** Non-Taiwan shops tracked with reason, not silently dropped
- **Positive:** Admin dash has structured data to visualize per-batch progress
- **Constraint:** Apify charges per shop regardless of geo-filter outcome — out-of-region shops still consume scraping credits (~$0.004/shop). Acceptable given the ~20% rejection rate
- **Constraint:** Concurrency ceiling is Claude's rate limit, not the semaphore. At `concurrency=5`, sustained enrichment stays well within Sonnet's default RPM limits
- **Future:** Consider pre-filtering obvious non-Taiwan shops at import time using the Google Maps Place ID prefix or URL heuristics, to avoid even the Apify cost on known foreign shops
