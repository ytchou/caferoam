from typing import Any, cast

from supabase import Client

from core.db import first
from models.types import CheckIn


class CheckInService:
    def __init__(self, db: Client):
        self._db = db

    async def create(
        self,
        user_id: str,
        shop_id: str,
        photo_urls: list[str],
        menu_photo_url: str | None = None,
        note: str | None = None,
    ) -> CheckIn:
        """Create a check-in. DB trigger handles stamp creation and job queueing."""
        if len(photo_urls) < 1:
            raise ValueError("At least one photo is required for check-in")

        checkin_data = {
            "user_id": user_id,
            "shop_id": shop_id,
            "photo_urls": photo_urls,
            "menu_photo_url": menu_photo_url,
            "note": note,
        }
        response = self._db.table("check_ins").insert(checkin_data).execute()
        rows = cast("list[dict[str, Any]]", response.data)
        return CheckIn(**first(rows, "create check-in"))

    async def get_by_user(self, user_id: str) -> list[CheckIn]:
        response = (
            self._db.table("check_ins")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        rows = cast("list[dict[str, Any]]", response.data)
        return [CheckIn(**row) for row in rows]

    async def get_by_shop(self, shop_id: str) -> list[CheckIn]:
        response = (
            self._db.table("check_ins")
            .select("*")
            .eq("shop_id", shop_id)
            .order("created_at", desc=True)
            .execute()
        )
        rows = cast("list[dict[str, Any]]", response.data)
        return [CheckIn(**row) for row in rows]
