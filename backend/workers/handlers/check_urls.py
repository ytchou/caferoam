"""Background URL validation worker.

Checks shops in pending_url_check status via HTTP HEAD requests.
Transitions: pending_url_check → pending_review (pass) | filtered_dead_url (fail)

Limitation: Cafe Nomad shops use constructed Google Maps search URLs
(https://www.google.com/maps/search/...) which always return HTTP 200.
These shops will always pass the URL check and move to pending_review.
This is acceptable for V1 — the admin review step is the effective quality gate
for Cafe Nomad imports. Google Takeout shops use canonical Maps URLs which can
return 404 for closed/removed places, making the check meaningful for that source.
"""

import asyncio
from typing import Any

import httpx
import structlog

logger = structlog.get_logger()

_BATCH_SIZE = 20  # 20 concurrent HEAD requests per round
_BATCH_DELAY_SECONDS = 0.5
_REQUEST_TIMEOUT = 5.0
_LOG_EVERY_N_BATCHES = 5  # progress log every 100 shops


async def _check_single_url(
    client: httpx.AsyncClient,
    shop_id: str,
    url: str,
) -> tuple[str, bool]:
    """Check a single URL. Returns (shop_id, is_alive)."""
    try:
        response = await client.head(url, follow_redirects=True, timeout=_REQUEST_TIMEOUT)
        return shop_id, response.status_code < 400
    except Exception:
        return shop_id, False


async def check_urls_for_region(
    db: Any,
) -> dict[str, int]:
    """Run background URL validation for all pending_url_check shops.

    Updates the DB after every batch so pipeline-status reflects live progress.
    Returns:
        {"checked": N, "passed": N, "failed": N}
    """
    response = (
        db.table("shops")
        .select("id, google_maps_url")
        .eq("processing_status", "pending_url_check")
        .execute()
    )
    shops: list[dict[str, Any]] = response.data or []

    if not shops:
        logger.info("url_check: no pending shops")
        return {"checked": 0, "passed": 0, "failed": 0}

    total = len(shops)
    logger.info("url_check: starting", total=total, batch_size=_BATCH_SIZE)

    total_passed = 0
    total_failed = 0
    total_errored = 0
    batch_num = 0

    async with httpx.AsyncClient() as client:
        for batch_start in range(0, total, _BATCH_SIZE):
            batch = shops[batch_start : batch_start + _BATCH_SIZE]
            batch_num += 1

            tasks = [
                _check_single_url(client, shop["id"], shop.get("google_maps_url", ""))
                for shop in batch
            ]
            results = await asyncio.gather(*tasks)

            passed_ids = [sid for sid, ok in results if ok]
            failed_ids = [sid for sid, ok in results if not ok]

            # Write each batch immediately — progress is visible in pipeline-status
            try:
                if passed_ids:
                    db.table("shops").update({"processing_status": "pending_review"}).in_(
                        "id", passed_ids
                    ).execute()
                if failed_ids:
                    db.table("shops").update({"processing_status": "filtered_dead_url"}).in_(
                        "id", failed_ids
                    ).execute()
                total_passed += len(passed_ids)
                total_failed += len(failed_ids)
            except Exception:
                total_errored += len(passed_ids) + len(failed_ids)
                logger.exception(
                    "url_check: DB write failed for batch",
                    batch_num=batch_num,
                    passed=len(passed_ids),
                    failed=len(failed_ids),
                )

            checked_so_far = batch_start + len(batch)
            if batch_num % _LOG_EVERY_N_BATCHES == 0 or checked_so_far >= total:
                logger.info(
                    "url_check: progress",
                    checked=checked_so_far,
                    total=total,
                    passed=total_passed,
                    failed=total_failed,
                    pct=round(checked_so_far / total * 100),
                )

            if batch_start + _BATCH_SIZE < total:
                await asyncio.sleep(_BATCH_DELAY_SECONDS)

    logger.info(
        "url_check: complete",
        total=total,
        passed=total_passed,
        failed=total_failed,
    )
    return {"checked": total, "passed": total_passed, "failed": total_failed, "errored": total_errored}
