import contextlib
from datetime import UTC, datetime
from typing import Any, cast

import structlog
from supabase import Client

from core.db import first
from models.types import JobType
from providers.scraper.interface import ScraperProvider
from workers.queue import JobQueue

logger = structlog.get_logger()


async def handle_staleness_sweep(db: Client, queue: JobQueue) -> None:
    """Find shops enriched >90 days ago and queue re-enrichment."""
    logger.info("Running staleness sweep")

    # Find stale shops via RPC (shops where enriched_at < now() - 90 days)
    response = db.rpc("find_stale_shops", {"days_threshold": 90, "batch_limit": 100}).execute()
    stale_shops = cast("list[dict[str, Any]]", response.data)

    for shop in stale_shops:
        await queue.enqueue(
            job_type=JobType.ENRICH_SHOP,
            payload={"shop_id": shop["id"]},
            priority=1,  # Low priority — background refresh
        )

    logger.info("Staleness sweep complete", stale_count=len(stale_shops))


async def handle_smart_staleness_sweep(
    db: Client,
    scraper: ScraperProvider,
    queue: JobQueue,
) -> None:
    """Smart staleness: only re-enrich when new Google reviews detected."""
    logger.info("Running smart staleness sweep")

    response = db.rpc("find_stale_shops", {"days_threshold": 90, "batch_limit": 100}).execute()
    stale_shops = cast("list[dict[str, Any]]", response.data)

    queued = 0
    skipped = 0
    now = datetime.now(UTC).isoformat()

    for shop in stale_shops:
        shop_id = shop["id"]
        google_place_id = shop.get("google_place_id")

        if not google_place_id:
            # No place ID to re-scrape from — fall back to re-enrichment with
            # existing stored data (limited value, but avoids silently skipping)
            await queue.enqueue(
                job_type=JobType.ENRICH_SHOP,
                payload={"shop_id": shop_id},
                priority=1,
            )
            queued += 1
            continue

        # Get latest stored review date
        stored_reviews = (
            db.table("shop_reviews")
            .select("published_at")
            .eq("shop_id", shop_id)
            .order("published_at", desc=True)
            .limit(1)
            .execute()
        )
        latest_stored = (
            first(stored_reviews.data, "latest stored review")["published_at"]
            if stored_reviews.data
            else None
        )  # type: ignore[call-overload]

        # Quick-scrape reviews only from Google Maps
        try:
            fresh_reviews = await scraper.scrape_reviews_only(google_place_id)
        except Exception as e:
            logger.warning("Failed to check reviews", shop_id=shop_id, error=str(e))
            db.table("shops").update({"last_checked_at": now}).eq("id", shop_id).execute()
            skipped += 1
            continue

        # Compare: are there newer reviews? Parse dates for safe comparison.
        has_new = False
        if fresh_reviews and latest_stored:
            scraped_dates = []
            for r in fresh_reviews:
                if r.get("published_at"):
                    with contextlib.suppress(ValueError, TypeError):
                        scraped_dates.append(datetime.fromisoformat(r["published_at"]))
            if scraped_dates:
                newest_scraped = max(scraped_dates)
                try:
                    stored_dt = datetime.fromisoformat(latest_stored)
                    if newest_scraped > stored_dt:
                        has_new = True
                except (ValueError, TypeError):
                    has_new = True  # Can't parse stored date — re-enrich to be safe
        elif fresh_reviews and not latest_stored:
            has_new = True

        if has_new:
            # Re-scrape to import the new review text, then the full pipeline
            # (SCRAPE → ENRICH → EMBED → PUBLISH) brings the fresh data live.
            # Using the canonical place-ID URL so Apify resolves the right shop.
            maps_url = f"https://www.google.com/maps/place/?q=place_id:{google_place_id}"
            await queue.enqueue(
                job_type=JobType.SCRAPE_SHOP,
                payload={"shop_id": shop_id, "google_maps_url": maps_url},
                priority=1,
            )
            queued += 1
        else:
            db.table("shops").update({"last_checked_at": now}).eq("id", shop_id).execute()
            skipped += 1

    logger.info(
        "Smart staleness sweep complete",
        stale_count=len(stale_shops),
        queued=queued,
        skipped=skipped,
    )
