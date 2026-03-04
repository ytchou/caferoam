# backend/services/profile_service.py
import asyncio
from typing import Any, cast

from supabase import Client

from models.types import ProfileResponse


class ProfileService:
    def __init__(self, db: Client):
        self._db = db

    async def get_profile(self, user_id: str) -> ProfileResponse:
        profile_resp, stamp_resp, checkin_resp = await asyncio.gather(
            asyncio.to_thread(
                lambda: self._db.table("profiles")
                .select("display_name, avatar_url")
                .eq("id", user_id)
                .single()
                .execute()
            ),
            asyncio.to_thread(
                lambda: self._db.table("stamps")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .execute()
            ),
            asyncio.to_thread(
                lambda: self._db.table("check_ins")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .execute()
            ),
        )
        profile = cast("dict[str, Any]", profile_resp.data)
        return ProfileResponse(
            display_name=profile.get("display_name"),
            avatar_url=profile.get("avatar_url"),
            stamp_count=stamp_resp.count or 0,
            checkin_count=checkin_resp.count or 0,
        )

    async def update_profile(
        self,
        user_id: str,
        display_name: str | None = None,
        avatar_url: str | None = None,
    ) -> None:
        update_data: dict[str, Any] = {}
        if display_name is not None:
            update_data["display_name"] = display_name
        if avatar_url is not None:
            update_data["avatar_url"] = avatar_url

        if not update_data:
            raise ValueError("No fields to update")

        self._db.table("profiles").update(update_data).eq("id", user_id).execute()
