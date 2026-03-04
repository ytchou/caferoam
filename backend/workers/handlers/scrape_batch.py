from datetime import UTC, datetime
from typing import Any

import structlog
from supabase import Client

from providers.scraper.interface import BatchScrapeInput, ScraperProvider
from workers.persist import persist_scraped_data
from workers.queue import JobQueue

logger = structlog.get_logger()


async def handle_scrape_batch(
    payload: dict[str, Any],
    db: Client,
    scraper: ScraperProvider,
    queue: JobQueue,
) -> None:
    """Scrape multiple shops in a single Apify actor run.

    Payload shape:
        {
            "batch_id": str,
            "shops": [{"shop_id": str, "google_maps_url": str, "submission_id"?: str, "submitted_by"?: str}]
        }
    """
    batch_id = payload["batch_id"]
    raw_shops = payload.get("shops", [])

    if not raw_shops:
        logger.warning("scrape_batch: no shops in payload", batch_id=batch_id)
        return

    shop_ids = [s["shop_id"] for s in raw_shops]
    logger.info("Batch scraping shops", batch_id=batch_id, count=len(shop_ids))

    # Set all shops to scraping in one batch UPDATE
    db.table("shops").update(
        {"processing_status": "scraping", "updated_at": datetime.now(UTC).isoformat()}
    ).in_("id", shop_ids).execute()

    batch_inputs = [
        BatchScrapeInput(shop_id=s["shop_id"], google_maps_url=s["google_maps_url"])
        for s in raw_shops
    ]

    results = await scraper.scrape_batch(batch_inputs)

    # Build lookup for submission context
    meta: dict[str, dict[str, str | None]] = {
        s["shop_id"]: {
            "submission_id": s.get("submission_id"),
            "submitted_by": s.get("submitted_by"),
        }
        for s in raw_shops
    }

    succeeded = 0
    failed = 0

    for result in results:
        shop_id = result.shop_id
        shop_meta = meta.get(shop_id, {})

        if result.data is None:
            logger.warning(
                "Batch: shop not found on Google Maps",
                shop_id=shop_id,
                batch_id=batch_id,
            )
            db.table("shops").update(
                {"processing_status": "failed", "updated_at": datetime.now(UTC).isoformat()}
            ).eq("id", shop_id).execute()

            submission_id = shop_meta.get("submission_id")
            if submission_id:
                db.table("shop_submissions").update(
                    {
                        "status": "failed",
                        "failure_reason": "Place not found on Google Maps",
                        "updated_at": datetime.now(UTC).isoformat(),
                    }
                ).eq("id", submission_id).execute()

            failed += 1
            continue

        try:
            await persist_scraped_data(
                shop_id=shop_id,
                data=result.data,
                db=db,
                queue=queue,
                submission_id=shop_meta.get("submission_id"),
                submitted_by=shop_meta.get("submitted_by"),
                batch_id=batch_id,
            )
            succeeded += 1
        except Exception as exc:
            logger.error(
                "Batch: failed to persist shop",
                shop_id=shop_id,
                batch_id=batch_id,
                error=str(exc),
            )
            db.table("shops").update(
                {"processing_status": "failed", "updated_at": datetime.now(UTC).isoformat()}
            ).eq("id", shop_id).execute()
            failed += 1

    logger.info(
        "Batch scrape complete",
        batch_id=batch_id,
        succeeded=succeeded,
        failed=failed,
        total=len(results),
    )
