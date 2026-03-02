from typing import Any, cast

import structlog
from fastapi import APIRouter, Depends, HTTPException

from api.deps import get_current_user
from core.config import settings
from db.supabase_client import get_service_role_client

logger = structlog.get_logger()

router = APIRouter(prefix="/admin/taxonomy", tags=["admin"])


def _require_admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:  # noqa: B008
    if user["id"] not in settings.admin_user_ids:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


@router.get("/stats")
async def taxonomy_stats(
    user: dict[str, Any] = Depends(_require_admin),  # noqa: B008
) -> dict[str, Any]:
    """Taxonomy coverage and quality stats."""
    db = get_service_role_client()

    # Total shops count
    total_resp = db.table("shops").select("id", count="exact").execute()
    total_shops = total_resp.count or 0

    # Tag frequency via RPC
    tagged_resp = db.rpc("shop_tag_counts", {}).execute()
    tag_frequency = cast("list[dict[str, Any]]", tagged_resp.data or [])
    unique_tagged_shops = len({row.get("shop_id") for row in tag_frequency if row.get("shop_id")})

    # Shops with embeddings
    embedded_resp = (
        db.table("shops").select("id", count="exact").not_.is_("embedding", "null").execute()
    )
    shops_with_embeddings = embedded_resp.count or 0

    # Low-confidence shops (max confidence < 0.5)
    low_conf_resp = db.rpc("shops_with_low_confidence_tags", {}).execute()
    low_confidence_shops = cast("list[dict[str, Any]]", low_conf_resp.data or [])

    # Shops missing embeddings
    missing_embed_resp = (
        db.table("shops")
        .select("id, name, processing_status")
        .is_("embedding", "null")
        .neq("processing_status", "pending")
        .limit(50)
        .execute()
    )

    return {
        "total_shops": total_shops,
        "shops_with_tags": unique_tagged_shops,
        "shops_with_embeddings": shops_with_embeddings,
        "shops_missing_tags": total_shops - unique_tagged_shops,
        "shops_missing_embeddings": total_shops - shops_with_embeddings,
        "tag_frequency": tag_frequency,
        "low_confidence_shops": low_confidence_shops,
        "missing_embeddings": cast("list[dict[str, Any]]", missing_embed_resp.data),
    }
