from typing import Any, cast

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic.alias_generators import to_camel

from api.deps import get_admin_db, get_current_user, get_optional_user
from core.db import first
from db.supabase_client import get_anon_client
from models.types import (
    ShopCheckInPreview,
    ShopCheckInSummary,
    ShopReview,
    ShopReviewsResponse,
    TaxonomyTag,
)

router = APIRouter(prefix="/shops", tags=["shops"])


def _extract_display_name(row: dict[str, Any]) -> str | None:
    profiles = row.get("profiles")
    if not profiles:
        return None
    return cast("str | None", profiles.get("display_name"))


_SHOP_COLUMNS = (
    "id, name, slug, address, city, mrt, latitude, longitude, "
    "rating, review_count, description, processing_status, "
    "mode_work, mode_rest, mode_social, created_at"
)


@router.get("/")
async def list_shops(
    city: str | None = None,
    featured: bool = False,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[Any]:
    """List shops. Public — no auth required."""
    db = get_anon_client()
    query = db.table("shops").select(_SHOP_COLUMNS)
    if city:
        query = query.eq("city", city)
    if featured:
        query = query.eq("processing_status", "live")
    query = query.limit(limit)
    response = query.execute()
    rows = cast("list[dict[str, Any]]", response.data or [])
    return [{to_camel(k): v for k, v in row.items()} for row in rows]


@router.get("/{shop_id}")
async def get_shop(shop_id: str) -> Any:
    """Get a single shop by ID. Public — no auth required."""
    db = get_anon_client()
    response = (
        db.table("shops")
        .select(
            f"{_SHOP_COLUMNS}, shop_photos(photo_url), "
            "shop_tags(tag_id, tag_name, taxonomy_tags(id, dimension, label, label_zh))"
        )
        .eq("id", shop_id)
        .maybe_single()
        .execute()
    )

    if response is None or not response.data:
        raise HTTPException(status_code=404, detail="Shop not found")
    shop: dict[str, Any] = cast("dict[str, Any]", response.data)

    photo_urls = [row["photo_url"] for row in (shop.pop("shop_photos", None) or [])]
    raw_tags = shop.pop("shop_tags", None) or []
    taxonomy_tags = [
        TaxonomyTag(**row["taxonomy_tags"]).model_dump(by_alias=True)
        for row in raw_tags
        if row.get("taxonomy_tags")
    ]
    mode_scores = {
        "work": shop.pop("mode_work", None),
        "rest": shop.pop("mode_rest", None),
        "social": shop.pop("mode_social", None),
    }

    response_data: dict[str, Any] = {to_camel(k): v for k, v in shop.items()}
    response_data["photoUrls"] = photo_urls
    response_data["modeScores"] = mode_scores
    response_data["taxonomyTags"] = taxonomy_tags
    return response_data


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
            .select(
                "id, user_id, photo_urls, note, created_at, stars, review_text, "
                "confirmed_tags, reviewed_at, profiles(display_name)"
            )
            .eq("shop_id", shop_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        rows = cast("list[dict[str, Any]]", response.data)
        return [
            ShopCheckInSummary(
                id=row["id"],
                user_id=row["user_id"],
                display_name=_extract_display_name(row),
                photo_url=str(row["photo_urls"][0]) if row.get("photo_urls") else "",
                note=row.get("note"),
                created_at=row["created_at"],
                stars=row.get("stars"),
                review_text=row.get("review_text"),
                confirmed_tags=row.get("confirmed_tags"),
                reviewed_at=row.get("reviewed_at"),
            ).model_dump(by_alias=True)
            for row in rows
        ]
    else:
        response = (
            db.table("check_ins")
            .select("photo_urls", count="exact")  # type: ignore[arg-type]
            .eq("shop_id", shop_id)
            .limit(1)
            .execute()
        )
        rows_preview = cast("list[dict[str, Any]]", response.data)
        first_row = first(rows_preview, "shop checkins preview") if response.data else None
        preview_url = (
            first_row["photo_urls"][0] if first_row and first_row.get("photo_urls") else None
        )
        return ShopCheckInPreview(
            count=response.count or 0,
            preview_photo_url=preview_url,
        ).model_dump(by_alias=True)


@router.get("/{shop_id}/reviews")
async def get_shop_reviews(
    shop_id: str,
    limit: int = Query(default=10, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    user: dict[str, Any] = Depends(get_current_user),  # noqa: B008
    db: Any = Depends(get_admin_db),  # noqa: B008
) -> dict[str, Any]:
    """Get reviews for a shop. Auth-gated.

    Returns paginated reviews (check-ins with stars), total count, and average rating.
    """

    response = (
        db.table("check_ins")
        .select(
            "id, user_id, stars, review_text, confirmed_tags, reviewed_at, profiles(display_name)",
            count="exact",
        )
        .eq("shop_id", shop_id)
        .not_("stars", "is", "null")
        .order("reviewed_at", desc=True)
        .limit(limit)
        .offset(offset)
        .execute()
    )

    review_rows = cast("list[dict[str, Any]]", response.data)
    reviews = [
        ShopReview(
            id=row["id"],
            user_id=row["user_id"],
            display_name=_extract_display_name(row),
            stars=row["stars"],
            review_text=row.get("review_text"),
            confirmed_tags=row.get("confirmed_tags"),
            reviewed_at=row["reviewed_at"],
        )
        for row in review_rows
    ]

    total_count = response.count or 0

    avg_response = db.rpc("shop_avg_rating", {"p_shop_id": shop_id}).execute()
    average_rating = float(avg_response.data) if avg_response.data else 0.0

    return ShopReviewsResponse(
        reviews=reviews,
        total_count=total_count,
        average_rating=round(average_rating, 1),
    ).model_dump(by_alias=True)
