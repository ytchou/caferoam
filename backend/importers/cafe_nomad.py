from typing import Any
from urllib.parse import quote

import httpx
import structlog

from core.db import first
from core.regions import DEFAULT_REGION, REGIONS, Region
from importers.prefilter import (
    PreFilterSummary,
    is_fuzzy_duplicate,
    is_known_failed_location,
    validate_shop_name,
)

logger = structlog.get_logger()

CAFENOMAD_API_BASE = "https://cafenomad.tw/api/v1.2/cafes"


def filter_cafenomad_shops(
    shops: list[dict[str, Any]],
    region: Region,
) -> tuple[list[dict[str, Any]], int]:
    """Filter Cafe Nomad shops: remove closed and out-of-bounds.

    Returns (filtered_shops, closed_count).
    """
    filtered = []
    closed_count = 0
    for shop in shops:
        if shop.get("closed"):
            closed_count += 1
            continue

        lat = float(shop.get("latitude", 0))
        lng = float(shop.get("longitude", 0))
        if not region.bounds.contains(lat, lng):
            continue

        filtered.append(shop)

    return filtered, closed_count


async def fetch_and_import_cafenomad(
    db: Any,
    region: Region | None = None,
) -> dict[str, Any]:
    """Fetch Cafe Nomad API and import shops with pre-filter.

    Shops are inserted with pending_url_check status for background URL validation.
    Returns an import summary dict.
    """

    if region is None:
        region = REGIONS[DEFAULT_REGION]

    city = region.cafenomad_city or "taipei"
    api_url = f"{CAFENOMAD_API_BASE}/{city}"

    async with httpx.AsyncClient() as client:
        response = await client.get(api_url, timeout=30)
        response.raise_for_status()
        raw_shops = response.json()

    shops, closed_count = filter_cafenomad_shops(raw_shops, region)

    # Pre-fetch existing shops and failed shops for bulk dedup checks (avoids N+1 queries)
    existing_resp = (
        db.table("shops")
        .select("id, name, latitude, longitude")
        .gte("latitude", region.bounds.min_lat)
        .lte("latitude", region.bounds.max_lat)
        .gte("longitude", region.bounds.min_lng)
        .lte("longitude", region.bounds.max_lng)
        .execute()
    )
    existing_shops: list[dict[str, Any]] = existing_resp.data or []

    failed_resp = (
        db.table("shops")
        .select("id, latitude, longitude")
        .eq("processing_status", "failed")
        .gte("latitude", region.bounds.min_lat)
        .lte("latitude", region.bounds.max_lat)
        .gte("longitude", region.bounds.min_lng)
        .lte("longitude", region.bounds.max_lng)
        .execute()
    )
    failed_shops: list[dict[str, Any]] = failed_resp.data or []

    # Pre-fetch existing cafenomad_ids to avoid per-shop duplicate check
    existing_ids_resp = (
        db.table("shops").select("cafenomad_id").not_.is_("cafenomad_id", "null").execute()
    )
    existing_cafenomad_ids: set[str] = {
        row["cafenomad_id"] for row in (existing_ids_resp.data or [])
    }

    summary = PreFilterSummary(closed=closed_count)
    imported = 0

    for shop in shops:
        cafenomad_id = shop.get("id", "")
        name = shop.get("name", "Unknown")
        lat = float(shop.get("latitude", 0))
        lng = float(shop.get("longitude", 0))

        # Pre-filter step 1 (URL validation) is skipped for Cafe Nomad — URLs are
        # constructed synthetically (maps.google.com/search/...) and always valid.
        # invalid_url stays 0 for this source.

        # Pre-filter step 2: Name validation
        name_result = validate_shop_name(name)
        if not name_result.passed:
            summary.invalid_name += 1
            continue

        # Pre-filter step 3: Known-failed check (in-memory, pre-fetched above)
        if is_known_failed_location(lat, lng, failed_shops):
            summary.known_failed += 1
            continue

        # Pre-filter step 4: Fuzzy dedup (flag, do not auto-reject)
        if is_fuzzy_duplicate(name, lat, lng, existing_shops):
            summary.flagged_duplicates += 1

        # Check if already imported by cafenomad_id (in-memory, pre-fetched above)
        if cafenomad_id in existing_cafenomad_ids:
            continue

        shop_addr = shop.get("address", "")
        query = quote(f"{name} {shop_addr}", safe="")
        google_maps_url = f"https://www.google.com/maps/search/{query}"

        try:
            insert_response = (
                db.table("shops")
                .insert(
                    {
                        "name": name,
                        "address": shop_addr,
                        "latitude": lat,
                        "longitude": lng,
                        "review_count": 0,
                        "cafenomad_id": cafenomad_id,
                        "processing_status": "pending_url_check",
                        "source": "cafe_nomad",
                        "website": shop.get("url"),
                        "mrt": shop.get("mrt"),
                        "google_maps_url": google_maps_url,
                    }
                )
                .execute()
            )
            first(insert_response.data, "import cafe nomad shop")
            imported += 1
        except Exception:
            logger.warning("Failed to import Cafe Nomad shop", cafenomad_id=cafenomad_id)
            continue

    logger.info(
        "Cafe Nomad import complete",
        total=len(raw_shops),
        filtered=len(shops),
        imported=imported,
        region=region.name,
    )

    return {
        "imported": imported,
        "filtered": {
            "invalid_url": summary.invalid_url,
            "invalid_name": summary.invalid_name,
            "known_failed": summary.known_failed,
            "closed": summary.closed,
        },
        "pending_url_check": imported,
        "flagged_duplicates": summary.flagged_duplicates,
        "region": region.name,
    }
