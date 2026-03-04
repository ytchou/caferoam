from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from supabase import Client

from api.deps import get_current_user, get_user_db
from services.checkin_service import CheckInService

router = APIRouter(prefix="/checkins", tags=["checkins"])


class CreateCheckInRequest(BaseModel):
    shop_id: str
    photo_urls: list[str]
    menu_photo_url: str | None = None
    note: str | None = None
    stars: int | None = None
    review_text: str | None = None
    confirmed_tags: list[str] | None = None

    @field_validator("stars")
    @classmethod
    def stars_must_be_valid(cls, v: int | None) -> int | None:
        if v is not None and not (1 <= v <= 5):
            raise ValueError("Stars must be between 1 and 5")
        return v


class UpdateReviewRequest(BaseModel):
    stars: int
    review_text: str | None = None
    confirmed_tags: list[str] | None = None

    @field_validator("stars")
    @classmethod
    def stars_must_be_valid(cls, v: int) -> int:
        if not (1 <= v <= 5):
            raise ValueError("Stars must be between 1 and 5")
        return v


@router.post("/")
async def create_checkin(
    body: CreateCheckInRequest,
    user: dict[str, Any] = Depends(get_current_user),  # noqa: B008
    db: Client = Depends(get_user_db),  # noqa: B008
) -> dict[str, Any]:
    """Create a check-in. Auth required."""
    service = CheckInService(db=db)
    try:
        result = await service.create(
            user_id=user["id"],
            shop_id=body.shop_id,
            photo_urls=body.photo_urls,
            menu_photo_url=body.menu_photo_url,
            note=body.note,
            stars=body.stars,
            review_text=body.review_text,
            confirmed_tags=body.confirmed_tags,
        )
        return result.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None


@router.patch("/{checkin_id}/review")
async def update_review(
    checkin_id: str,
    body: UpdateReviewRequest,
    user: dict[str, Any] = Depends(get_current_user),  # noqa: B008
    db: Client = Depends(get_user_db),  # noqa: B008
) -> dict[str, Any]:
    """Add or update a review on an existing check-in. Auth required."""
    service = CheckInService(db=db)
    try:
        result = await service.update_review(
            checkin_id=checkin_id,
            user_id=user["id"],
            stars=body.stars,
            review_text=body.review_text,
            confirmed_tags=body.confirmed_tags,
        )
        return result.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e)) from None


@router.get("/")
async def get_my_checkins(
    user: dict[str, Any] = Depends(get_current_user),  # noqa: B008
    db: Client = Depends(get_user_db),  # noqa: B008
) -> list[dict[str, Any]]:
    """Get current user's check-ins. Auth required."""
    service = CheckInService(db=db)
    results = await service.get_by_user(user["id"])
    return [r.model_dump() for r in results]
