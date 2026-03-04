from typing import Any

from fastapi import APIRouter, Depends, Query

from api.deps import get_admin_db, get_optional_user
from core.db import first
from db.supabase_client import get_anon_client
from models.types import ShopCheckInPreview, ShopCheckInSummary

router = APIRouter(prefix="/shops", tags=["shops"])


@router.get("/")
async def list_shops(city: str | None = None) -> list[Any]:
    """List shops. Public — no auth required."""
    db = get_anon_client()
    query = db.table("shops").select("*")
    if city:
        query = query.eq("city", city)
    response = query.execute()
    return response.data


@router.get("/{shop_id}")
async def get_shop(shop_id: str) -> Any:
    """Get a single shop by ID. Public — no auth required."""
    db = get_anon_client()
    response = db.table("shops").select("*").eq("id", shop_id).single().execute()
    return response.data


@router.get("/{shop_id}/checkins")
async def get_shop_checkins(
    shop_id: str,
    limit: int = Query(default=9, ge=1, le=50),
    user: dict[str, Any] | None = Depends(get_optional_user),  # noqa: B008
) -> list[dict[str, Any]] | dict[str, Any]:
    """Get check-ins for a shop. Auth-gated response shape.

    Authenticated: full check-in summaries with display names.
    Unauthenticated: count + one representative photo.
    """
    db = get_admin_db()

    if user:
        response = (
            db.table("check_ins")
            .select("id, user_id, photo_urls, note, created_at, profiles(display_name)")
            .eq("shop_id", shop_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [
            ShopCheckInSummary(
                id=row["id"],
                user_id=row["user_id"],
                display_name=(
                    row.get("profiles", {}).get("display_name") if row.get("profiles") else None
                ),
                photo_url=row["photo_urls"][0] if row.get("photo_urls") else None,
                note=row.get("note"),
                created_at=row["created_at"],
            ).model_dump()
            for row in response.data
        ]
    else:
        response = (
            db.table("check_ins")
            .select("photo_urls", count="exact")
            .eq("shop_id", shop_id)
            .limit(1)
            .execute()
        )
        first_row = first(response.data, "shop checkins preview") if response.data else None
        preview_url = (
            first_row["photo_urls"][0] if first_row and first_row.get("photo_urls") else None
        )
        return ShopCheckInPreview(
            count=response.count or 0,
            preview_photo_url=preview_url,
        ).model_dump()
