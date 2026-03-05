# backend/api/profile.py
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from supabase import Client

from api.deps import get_current_user, get_user_db
from models.types import ProfileUpdateRequest
from services.profile_service import ProfileService

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("")
async def get_profile(
    user: dict[str, Any] = Depends(get_current_user),
    db: Client = Depends(get_user_db),
) -> dict[str, Any]:
    service = ProfileService(db=db)
    result = await service.get_profile(user["id"])
    return result.model_dump()


@router.patch("")
async def update_profile(
    body: ProfileUpdateRequest,
    user: dict[str, Any] = Depends(get_current_user),
    db: Client = Depends(get_user_db),
) -> dict[str, str]:
    service = ProfileService(db=db)
    await service.update_profile(
        user["id"],
        fields=body.model_fields_set,
        display_name=body.display_name,
        avatar_url=body.avatar_url,
    )
    return {"message": "Profile updated"}
