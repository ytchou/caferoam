from datetime import UTC, datetime
from typing import Any, cast
from uuid import uuid4

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, Form, HTTPException, Query, UploadFile
from pydantic import BaseModel

from api.deps import require_admin
from core.db import escape_ilike, first
from core.regions import DEFAULT_REGION, REGIONS
from db.supabase_client import get_service_role_client
from middleware.admin_audit import log_admin_action
from models.types import JobStatus, JobType, ProcessingStatus
from providers.embeddings import EmbeddingsProvider, get_embeddings_provider
from workers.queue import JobQueue

logger = structlog.get_logger()

router = APIRouter(prefix="/admin/shops", tags=["admin"])


class CreateShopRequest(BaseModel):
    name: str
    address: str
    latitude: float
    longitude: float
    google_maps_url: str | None = None


class UpdateShopRequest(BaseModel):
    name: str | None = None
    address: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    phone: str | None = None
    website: str | None = None
    opening_hours: list[str] | None = None
    description: str | None = None
    processing_status: ProcessingStatus | None = None


class EnqueueRequest(BaseModel):
    job_type: JobType


class CafeNomadImportRequest(BaseModel):
    region: str = DEFAULT_REGION


class BulkApproveRequest(BaseModel):
    shop_ids: list[str] | None = None


class CheckUrlsRequest(BaseModel):
    pass


@router.get("/pipeline-status")
async def pipeline_status(
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, int]:
    """Return shop counts grouped by processing_status."""
    db = get_service_role_client()
    response = db.table("shops").select("processing_status").execute()
    counts: dict[str, int] = {}
    for row in response.data or []:
        s = row["processing_status"]
        counts[s] = counts.get(s, 0) + 1
    return counts


@router.get("/")
async def list_shops(
    processing_status: str | None = None,
    source: str | None = None,
    search: str | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, Any]:
    """List all shops with optional filters."""
    db = get_service_role_client()
    query = db.table("shops").select(
        "id, name, address, processing_status, source, enriched_at, embedding, shop_tags(count)",
        count="exact",
    )

    if processing_status:
        query = query.eq("processing_status", processing_status)
    if source:
        query = query.eq("source", source)
    if search:
        query = query.ilike("name", f"%{escape_ilike(search)}%")

    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    response = query.execute()

    shops = []
    for row in cast("list[dict[str, Any]]", response.data):
        row["has_embedding"] = row.pop("embedding") is not None
        row["tag_count"] = row.pop("shop_tags", [{}])[0].get("count", 0)
        shops.append(row)

    return {"shops": shops, "total": response.count or 0}


@router.post("/", status_code=201)
async def create_shop(
    body: CreateShopRequest,
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, Any]:
    """Manually create a shop."""
    db = get_service_role_client()
    response = (
        db.table("shops")
        .insert(
            {
                "name": body.name,
                "address": body.address,
                "latitude": body.latitude,
                "longitude": body.longitude,
                "google_maps_url": body.google_maps_url,
                "source": "manual",
                "processing_status": "pending",
                "review_count": 0,
            }
        )
        .execute()
    )
    shop = first(cast("list[dict[str, Any]]", response.data), "create shop")
    log_admin_action(
        admin_user_id=user["id"],
        action="POST /admin/shops",
        target_type="shop",
        target_id=str(shop["id"]),
    )
    return shop


@router.post("/import/cafe-nomad", status_code=202)
async def import_cafe_nomad(
    body: CafeNomadImportRequest,
    background_tasks: BackgroundTasks,
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, Any]:
    """Trigger a Cafe Nomad import for the given region.

    Automatically kicks off URL validation as a background task when shops are imported.
    """
    from importers.cafe_nomad import fetch_and_import_cafenomad
    from workers.handlers.check_urls import check_urls_for_region

    if body.region not in REGIONS:
        raise HTTPException(status_code=400, detail=f"Unknown region: {body.region}")

    region = REGIONS[body.region]
    db = get_service_role_client()

    try:
        result = await fetch_and_import_cafenomad(db=db, region=region)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Cafe Nomad API error: {exc}") from exc

    if result.get("pending_url_check", 0) > 0:
        background_tasks.add_task(check_urls_for_region, db=db)

    log_admin_action(
        admin_user_id=user["id"],
        action="POST /admin/shops/import/cafe-nomad",
        target_type="import",
        payload={"region": body.region, "imported": result.get("imported", 0)},
    )
    return result


@router.post("/import/google-takeout", status_code=202)
async def import_google_takeout(
    file: UploadFile,
    background_tasks: BackgroundTasks,
    region: str = Form(DEFAULT_REGION),
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, Any]:
    """Upload a Google Takeout GeoJSON or CSV and import shops.

    Accepts:
    - GeoJSON FeatureCollection (.json/.geojson) — includes coordinates, filtered to region bounds.
    - CSV with columns Title, Note, URL, Tags, Comment (.csv) — no coordinates; scraper fills them in.
    """
    import json

    from importers.google_takeout import (
        import_takeout_to_queue,
        parse_takeout_csv,
        parse_takeout_geojson,
    )
    from workers.handlers.check_urls import check_urls_for_region

    if region not in REGIONS:
        raise HTTPException(status_code=400, detail=f"Unknown region: {region}")

    region_obj = REGIONS[region]

    content = await file.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File exceeds 10MB limit")

    filename = (file.filename or "").lower()
    is_csv = filename.endswith(".csv")

    if is_csv:
        places = parse_takeout_csv(content.decode("utf-8-sig"))  # utf-8-sig strips Excel BOM
    else:
        try:
            geojson = json.loads(content)
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=422, detail=f"Invalid JSON: {exc}") from exc
        if not isinstance(geojson, dict) or geojson.get("type") != "FeatureCollection":
            raise HTTPException(status_code=422, detail="File must be a GeoJSON FeatureCollection")
        places = parse_takeout_geojson(geojson, bounds=region_obj.bounds)

    db = get_service_role_client()

    result = await import_takeout_to_queue(
        places=places,
        db=db,
        bounds=region_obj.bounds,
        region_name=region,
    )

    if result.get("pending_url_check", 0) > 0:
        background_tasks.add_task(check_urls_for_region, db=db)

    log_admin_action(
        admin_user_id=user["id"],
        action="POST /admin/shops/import/google-takeout",
        target_type="import",
        payload={"region": region, "imported": result.get("imported", 0), "format": "csv" if is_csv else "geojson"},
    )
    return result


@router.post("/bulk-approve")
async def bulk_approve(
    body: BulkApproveRequest,
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, Any]:
    """Approve pending_review shops, transitioning them to pending and queuing scrape jobs.

    Accepts explicit shop_ids (max 50) or approves all pending_review shops.
    """
    db = get_service_role_client()

    if body.shop_ids is not None:
        if len(body.shop_ids) > 50:
            raise HTTPException(status_code=400, detail="Maximum 50 shops per bulk-approve request")
        shops_to_approve = body.shop_ids
    else:
        # Approve all pending_review — capped at 200 to prevent request timeouts
        resp = (
            db.table("shops")
            .select("id")
            .eq("processing_status", ProcessingStatus.PENDING_REVIEW.value)
            .limit(200)
            .execute()
        )
        shops_to_approve = [row["id"] for row in cast("list[dict[str, Any]]", resp.data or [])]

    if not shops_to_approve:
        return {"approved": 0, "queued": 0}

    batch_id = str(uuid4())
    queue = JobQueue(db=db)

    # Batch SELECT — one round-trip to get all URLs, filtered to pending_review only
    url_resp = (
        db.table("shops")
        .select("id, google_maps_url")
        .in_("id", shops_to_approve)
        .eq("processing_status", ProcessingStatus.PENDING_REVIEW.value)
        .execute()
    )
    eligible = cast("list[dict[str, Any]]", url_resp.data or [])
    eligible_ids = [row["id"] for row in eligible]

    approved = 0
    if eligible_ids:
        # Batch UPDATE — conditional on status to guard against concurrent changes
        update_resp = (
            db.table("shops")
            .update({"processing_status": ProcessingStatus.PENDING.value})
            .in_("id", eligible_ids)
            .eq("processing_status", ProcessingStatus.PENDING_REVIEW.value)
            .execute()
        )
        approved = len(update_resp.data or [])

    batch_shops = [
        {"shop_id": row["id"], "google_maps_url": row["google_maps_url"]}
        for row in eligible
        if row.get("google_maps_url")
    ]

    queued = 0
    if batch_shops:
        await queue.enqueue(
            job_type=JobType.SCRAPE_BATCH,
            payload={"batch_id": batch_id, "shops": batch_shops},
            priority=5,
        )
        queued = len(batch_shops)

    log_admin_action(
        admin_user_id=user["id"],
        action="POST /admin/shops/bulk-approve",
        target_type="import",
        payload={"approved": approved, "queued": queued, "batch_id": batch_id},
    )
    return {"approved": approved, "queued": queued, "batch_id": batch_id}


@router.post("/import/check-urls", status_code=202)
async def trigger_url_check(
    background_tasks: BackgroundTasks,
    body: CheckUrlsRequest,
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, Any]:
    """Kick off background HTTP HEAD validation for shops in pending_url_check status."""
    from workers.handlers.check_urls import check_urls_for_region

    db = get_service_role_client()

    # Count shops awaiting check
    count_resp = (
        db.table("shops")
        .select("id", count="exact")  # type: ignore[arg-type]
        .eq("processing_status", "pending_url_check")
        .execute()
    )
    checking = count_resp.count or 0
    logger.info("url_check: trigger received", checking=checking)

    background_tasks.add_task(check_urls_for_region, db=db)
    logger.info("url_check: background task queued")

    log_admin_action(
        admin_user_id=user["id"],
        action="POST /admin/shops/import/check-urls",
        target_type="import",
        payload={"checking": checking},
    )
    return {"checking": checking}


@router.get("/{shop_id}")
async def get_shop_detail(
    shop_id: str,
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, Any]:
    """Full shop detail including tags, photos, and mode scores."""
    db = get_service_role_client()

    try:
        shop_resp = db.table("shops").select("*").eq("id", shop_id).single().execute()
    except Exception:
        raise HTTPException(status_code=404, detail=f"Shop {shop_id} not found") from None

    tags_resp = db.table("shop_tags").select("tag_id, confidence").eq("shop_id", shop_id).execute()
    photos_resp = (
        db.table("shop_photos")
        .select("id, url, category, is_menu, sort_order")
        .eq("shop_id", shop_id)
        .order("sort_order")
        .execute()
    )

    return {
        "shop": shop_resp.data,
        "tags": cast("list[dict[str, Any]]", tags_resp.data),
        "photos": cast("list[dict[str, Any]]", photos_resp.data),
    }


@router.put("/{shop_id}")
async def update_shop(
    shop_id: str,
    body: UpdateShopRequest,
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, Any]:
    """Update shop identity fields. Sets manually_edited_at timestamp."""
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    updates["manually_edited_at"] = datetime.now(UTC).isoformat()
    updates["updated_at"] = datetime.now(UTC).isoformat()

    db = get_service_role_client()
    response = db.table("shops").update(updates).eq("id", shop_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail=f"Shop {shop_id} not found")

    log_admin_action(
        admin_user_id=user["id"],
        action="PUT /admin/shops",
        target_type="shop",
        target_id=shop_id,
    )
    return first(cast("list[dict[str, Any]]", response.data), "update shop")


@router.post("/{shop_id}/enqueue")
async def enqueue_job(
    shop_id: str,
    body: EnqueueRequest,
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, Any]:
    """Manually enqueue a pipeline job for a shop."""
    if body.job_type not in (JobType.ENRICH_SHOP, JobType.GENERATE_EMBEDDING, JobType.SCRAPE_SHOP):
        raise HTTPException(
            status_code=400, detail=f"Cannot manually enqueue {body.job_type.value}"
        )

    db = get_service_role_client()

    existing = (
        db.table("job_queue")
        .select("id")
        .eq("job_type", body.job_type.value)
        .eq("status", JobStatus.PENDING.value)
        .eq("payload->>shop_id", shop_id)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=409,
            detail=f"A pending {body.job_type.value} job already exists for shop {shop_id}",
        )

    # scrape_shop handler requires google_maps_url in payload — fetch it from the shop row
    payload: dict[str, Any] = {"shop_id": shop_id}
    if body.job_type == JobType.SCRAPE_SHOP:
        shop_row = db.table("shops").select("google_maps_url").eq("id", shop_id).single().execute()
        shop_row_data = cast("dict[str, Any]", shop_row.data) if shop_row.data else None
        if not shop_row_data or not shop_row_data.get("google_maps_url"):
            raise HTTPException(
                status_code=422,
                detail=f"Shop {shop_id} has no google_maps_url — cannot enqueue scrape job",
            )
        payload["google_maps_url"] = shop_row_data["google_maps_url"]

    queue = JobQueue(db=db)
    job_id = await queue.enqueue(
        job_type=body.job_type,
        payload=payload,
        priority=5,
    )
    log_admin_action(
        admin_user_id=user["id"],
        action=f"POST /admin/shops/{shop_id}/enqueue",
        target_type="job",
        target_id=job_id,
        payload={"job_type": body.job_type.value, "shop_id": shop_id},
    )
    return {"job_id": job_id, "job_type": body.job_type.value}


@router.get("/{shop_id}/search-rank")
async def search_rank(
    shop_id: str,
    query: str = Query(..., min_length=1),
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
    embeddings: EmbeddingsProvider = Depends(get_embeddings_provider),  # noqa: B008
) -> dict[str, Any]:
    """Run a search query and return where this shop ranks in results."""
    query_embedding = await embeddings.embed(query)

    db = get_service_role_client()
    response = db.rpc(
        "admin_search_shops",
        {"query_embedding": query_embedding, "match_count": 50},
    ).execute()

    results = cast("list[dict[str, Any]]", response.data or [])
    rank = None
    for i, result in enumerate(results, 1):
        if str(result["id"]) == shop_id:
            rank = i
            break

    return {
        "rank": rank,
        "total_results": len(results),
        "query": query,
        "found": rank is not None,
    }
