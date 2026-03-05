# backend/services/profile_service.py
import asyncio
from datetime import UTC, datetime, timedelta
from typing import Any, cast

from supabase import Client

from models.types import ProfileResponse


class ProfileService:
    def __init__(self, db: Client):
        self._db = db

    async def get_profile(self, user_id: str) -> ProfileResponse:
        profile_resp, stamp_resp, checkin_resp = await asyncio.gather(
            asyncio.to_thread(
                lambda: (
                    self._db.table("profiles")
                    .select("display_name, avatar_url")
                    .eq("id", user_id)
                    .limit(1)
                    .execute()
                )
            ),
            asyncio.to_thread(
                lambda: (
                    self._db.table("stamps")
                    .select("id", count="exact")  # type: ignore[arg-type]
                    .eq("user_id", user_id)
                    .execute()
                )
            ),
            asyncio.to_thread(
                lambda: (
                    self._db.table("check_ins")
                    .select("id", count="exact")  # type: ignore[arg-type]
                    .eq("user_id", user_id)
                    .execute()
                )
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

    async def session_heartbeat(self, user_id: str) -> dict[str, int]:
        """Track session start for analytics. Deduplicates within 30 min.

        Note: read-modify-write race exists on session_count (concurrent requests
        could lose an increment). Acceptable for analytics — an atomic RPC can
        replace this if precision becomes important.
        """
        profile_resp = await asyncio.to_thread(
            lambda: (
                self._db.table("profiles")
                .select("session_count, first_session_at, last_session_at")
                .eq("id", user_id)
                .single()
                .execute()
            )
        )
        profile = cast("dict[str, Any]", profile_resp.data)
        session_count: int = profile.get("session_count") or 0
        previous_count = session_count  # capture before potential increment
        first_session_at = profile.get("first_session_at")
        last_session_at = profile.get("last_session_at")

        now = datetime.now(UTC)

        should_increment = True
        if last_session_at:
            last_dt = datetime.fromisoformat(last_session_at)
            if (now - last_dt) < timedelta(minutes=30):
                should_increment = False

        if should_increment:
            update_data: dict[str, Any] = {
                "session_count": session_count + 1,
                "last_session_at": now.isoformat(),
            }
            if first_session_at is None:
                update_data["first_session_at"] = now.isoformat()

            await asyncio.to_thread(
                lambda: self._db.table("profiles").update(update_data).eq("id", user_id).execute()
            )
            session_count += 1
            if first_session_at is None:
                first_session_at = now.isoformat()

        days = 0
        if first_session_at:
            days = (now - datetime.fromisoformat(first_session_at)).days

        return {
            "days_since_first_session": days,
            "previous_sessions": previous_count,
        }
