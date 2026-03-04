from datetime import UTC, datetime
from typing import Any

import structlog
from supabase import Client

from providers.scraper.interface import ScraperProvider
from workers.persist import persist_scraped_data
from workers.queue import JobQueue

logger = structlog.get_logger()


async def handle_scrape_shop(
    payload: dict[str, Any],
    db: Client,
    scraper: ScraperProvider,
    queue: JobQueue,
) -> None:
    """Scrape a shop from Google Maps via Apify and store the data."""
    shop_id = payload["shop_id"]
    google_maps_url = payload["google_maps_url"]
    submission_id = payload.get("submission_id")
    submitted_by = payload.get("submitted_by")

    logger.info("Scraping shop", shop_id=shop_id, url=google_maps_url)

    # Update processing status
    db.table("shops").update(
        {"processing_status": "scraping", "updated_at": datetime.now(UTC).isoformat()}
    ).eq("id", shop_id).execute()

    # Scrape via Apify
    data = await scraper.scrape_by_url(google_maps_url)

    if data is None:
        logger.warning("Shop not found on Google Maps", shop_id=shop_id, url=google_maps_url)
        db.table("shops").update(
            {"processing_status": "failed", "updated_at": datetime.now(UTC).isoformat()}
        ).eq("id", shop_id).execute()

        if submission_id:
            db.table("shop_submissions").update(
                {
                    "status": "failed",
                    "failure_reason": "Place not found on Google Maps",
                    "updated_at": datetime.now(UTC).isoformat(),
                }
            ).eq("id", submission_id).execute()

        return

    try:
        await persist_scraped_data(
            shop_id=shop_id,
            data=data,
            db=db,
            queue=queue,
            submission_id=submission_id,
            submitted_by=submitted_by,
            batch_id=payload.get("batch_id"),
        )
    except Exception as exc:
        logger.error("Failed to persist scraped data", shop_id=shop_id, error=str(exc))
        db.table("shops").update(
            {"processing_status": "failed", "updated_at": datetime.now(UTC).isoformat()}
        ).eq("id", shop_id).execute()
        raise

    logger.info(
        "Shop scraped",
        shop_id=shop_id,
        reviews=len(data.reviews),
        photos=len(data.photo_urls),
    )
