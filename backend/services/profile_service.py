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
                .limit(1)
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
        rows = cast("list[dict[str, Any]]", profile_resp.data)
        profile = rows[0] if rows else {}
        return ProfileResponse(
            display_name=profile.get("display_name"),
            avatar_url=profile.get("avatar_url"),
            stamp_count=stamp_resp.count or 0,
            checkin_count=checkin_resp.count or 0,
        )

    async def update_profile(
        self,
        user_id: str,
        fields: set[str],
        display_name: str | None = None,
        avatar_url: str | None = None,
    ) -> None:
        """Update profile fields. `fields` is the set of keys explicitly provided in the request."""
        update_data: dict[str, Any] = {}
        if "display_name" in fields:
            update_data["display_name"] = display_name
        if "avatar_url" in fields:
            update_data["avatar_url"] = avatar_url

        if not update_data:
            return  # nothing to update — no-op

        await asyncio.to_thread(
            lambda: self._db.table("profiles").update(update_data).eq("id", user_id).execute()
        )
