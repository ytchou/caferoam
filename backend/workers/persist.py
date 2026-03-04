from datetime import UTC, datetime
from typing import Any

import structlog
from supabase import Client

from models.types import JobType
from providers.scraper.interface import ScrapedShopData
from workers.queue import JobQueue

logger = structlog.get_logger()


async def persist_scraped_data(
    shop_id: str,
    data: ScrapedShopData,
    db: Client,
    queue: JobQueue,
    submission_id: str | None = None,
    submitted_by: str | None = None,
    batch_id: str | None = None,
) -> None:
    """Persist scraped shop data and enqueue enrichment. Shared by single and batch scrape handlers."""
    # Update shop with scraped data; advance status to enriching
    db.table("shops").update(
        {
            "name": data.name,
            "address": data.address,
            "latitude": data.latitude,
            "longitude": data.longitude,
            "google_place_id": data.google_place_id,
            "rating": data.rating,
            "review_count": data.review_count,
            "opening_hours": data.opening_hours,
            "phone": data.phone,
            "website": data.website,
            "menu_url": data.menu_url,
            "processing_status": "enriching",
            "updated_at": datetime.now(UTC).isoformat(),
        }
    ).eq("id", shop_id).execute()

    # Replace reviews: snapshot old rows, delete, insert fresh batch.
    # If insert fails, restore the snapshot to avoid losing existing reviews.
    if data.reviews:
        review_rows = [
            {
                "shop_id": shop_id,
                "text": r["text"],
                "stars": r.get("stars"),
                "published_at": r.get("published_at"),
            }
            for r in data.reviews
            if r.get("text")
        ]
        if review_rows:
            snapshot = db.table("shop_reviews").select("*").eq("shop_id", shop_id).execute()
            old_reviews = snapshot.data or []
            db.table("shop_reviews").delete().eq("shop_id", shop_id).execute()
            try:
                db.table("shop_reviews").insert(review_rows).execute()
            except Exception:
                logger.warning("Review insert failed — restoring snapshot", shop_id=shop_id)
                if old_reviews:
                    db.table("shop_reviews").insert(old_reviews).execute()
                raise  # Caller must reset shop status to "failed" before propagating

    # Store photos — upsert on (shop_id, url) to avoid duplicates on re-scrape
    if data.photo_urls:
        photo_rows = [
            {"shop_id": shop_id, "url": url, "sort_order": i}
            for i, url in enumerate(data.photo_urls)
        ]
        db.table("shop_photos").upsert(photo_rows, on_conflict="shop_id,url").execute()

    # Link submission to shop
    if submission_id:
        db.table("shop_submissions").update(
            {
                "shop_id": shop_id,
                "status": "processing",
                "updated_at": datetime.now(UTC).isoformat(),
            }
        ).eq("id", submission_id).execute()

    # Queue enrichment — forward submission context + batch tracking
    enrich_payload: dict[str, Any] = {"shop_id": shop_id}
    if submission_id:
        enrich_payload["submission_id"] = submission_id
    if submitted_by:
        enrich_payload["submitted_by"] = submitted_by
    if batch_id:
        enrich_payload["batch_id"] = batch_id
    await queue.enqueue(
        job_type=JobType.ENRICH_SHOP,
        payload=enrich_payload,
        priority=5,
    )
