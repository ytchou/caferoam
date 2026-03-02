from datetime import UTC, datetime
from typing import Any, cast

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from api.deps import require_admin
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
        escaped = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.ilike("name", f"%{escaped}%")

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
    shop = cast("list[dict[str, Any]]", response.data)[0]
    log_admin_action(
        admin_user_id=user["id"],
        action="POST /admin/shops",
        target_type="shop",
        target_id=str(shop["id"]),
    )
    return shop


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
    return cast("list[dict[str, Any]]", response.data)[0]


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
        if not shop_row.data or not shop_row.data.get("google_maps_url"):
            raise HTTPException(
                status_code=422,
                detail=f"Shop {shop_id} has no google_maps_url — cannot enqueue scrape job",
            )
        payload["google_maps_url"] = shop_row.data["google_maps_url"]

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
