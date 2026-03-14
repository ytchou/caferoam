# Filter scope must match the denominator in percentage calculations

**Date:** 2026-03-14  
**Context:** `run_tag_audit.py` — tag frequency calculation across live shops  
**What happened:** `_fetch_shop_tags` fetched tags for ALL shops (no status filter), but `_tag_frequency` computed percentages against `total_live_shops`. Non-live shop tags inflated numerator counts, producing percentages > 100% in edge cases.  
**Root cause:** The fetch query and the percentage denominator were independently defined, with no co-location or shared constraint ensuring they agreed on population scope.  
**Prevention:** When computing `x / total`, ensure `x` is drawn from the same filtered population as `total`. If `total = len(live_shops)`, then the query producing `x` must also filter to `processing_status = 'live'`. Co-locate the filter (pass `live_shop_ids` into the fetch helper, or inline the filter).
