from typing import Any, cast

import structlog
from fastapi import APIRouter, Depends

from api.deps import require_admin
from db.supabase_client import get_service_role_client

logger = structlog.get_logger()

router = APIRouter(prefix="/admin/taxonomy", tags=["admin"])


@router.get("/stats")
async def taxonomy_stats(
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, Any]:
    """Taxonomy coverage and quality stats."""
    db = get_service_role_client()

    # Total shops count
    total_resp = db.table("shops").select("id", count="exact").execute()
    total_shops = total_resp.count or 0

    # Tag frequency via RPC (returns {tag_id, shop_count} rows)
    tagged_resp = db.rpc("shop_tag_counts", {}).execute()
    tag_frequency = cast("list[dict[str, Any]]", tagged_resp.data or [])

    # Count distinct shops with at least one tag — use RPC to avoid PostgREST row-limit truncation.
    tagged_count_resp = db.rpc("tagged_shop_count", {}).execute()
    unique_tagged_shops = int(tagged_count_resp.data or 0)

    # Shops with embeddings
    embedded_resp = (
        db.table("shops").select("id", count="exact").not_.is_("embedding", "null").execute()
    )
    shops_with_embeddings = embedded_resp.count or 0

    # Low-confidence shops (max confidence < 0.5)
    # RPC returns shop_id/shop_name — normalize to id/name for consistency with missing_embeddings.
    low_conf_resp = db.rpc("shops_with_low_confidence_tags", {}).execute()
    low_confidence_shops = [
        {"id": row["shop_id"], "name": row["shop_name"], "max_confidence": row["max_confidence"]}
        for row in (low_conf_resp.data or [])
    ]

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
