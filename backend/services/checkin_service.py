import asyncio
from datetime import datetime, timezone
from typing import Any, cast

from supabase import Client

from core.db import first
from models.types import CheckIn, CheckInWithShop, CreateCheckInResponse


class CheckInService:
    def __init__(self, db: Client):
        self._db = db

    @staticmethod
    def _validate_stars(stars: int) -> None:
        if not (1 <= stars <= 5):
            raise ValueError("Stars must be between 1 and 5")

    async def _validate_confirmed_tags(self, tags: list[str]) -> None:
        """Validate that all confirmed_tags exist in taxonomy_tags table."""
        if not tags:
            return
        response = await asyncio.to_thread(
            lambda: (
                self._db.table("taxonomy_tags")
                .select("id")
                .in_("id", tags)
                .execute()
            )
        )
        rows: list[dict[str, Any]] = cast("list[dict[str, Any]]", response.data or [])
        found_ids = {row["id"] for row in rows}
        unknown = set(tags) - found_ids
        if unknown:
            raise ValueError(f"Unknown tag IDs: {sorted(unknown)}")

    async def create(
        self,
        user_id: str,
        shop_id: str,
        photo_urls: list[str],
        menu_photo_url: str | None = None,
        note: str | None = None,
        stars: int | None = None,
        review_text: str | None = None,
        confirmed_tags: list[str] | None = None,
    ) -> CreateCheckInResponse:
        """Create a check-in. DB trigger handles stamp creation and job queueing."""
        if len(photo_urls) < 1:
            raise ValueError("At least one photo is required for check-in")
        if review_text is not None and stars is None:
            raise ValueError("review_text requires a star rating")
        if confirmed_tags and stars is None:
            raise ValueError("confirmed_tags requires a star rating")
        if stars is not None:
            self._validate_stars(stars)
        if confirmed_tags:
            await self._validate_confirmed_tags(confirmed_tags)

        # Check if this is the user's first check-in at this shop.
        # Note: TOCTOU race exists (concurrent requests could both see count=0).
        # Acceptable because this field is analytics-only metadata, not business logic.
        count_resp = await asyncio.to_thread(
            lambda: (
                self._db.table("check_ins")
                .select("id", count="exact")
                .eq("user_id", user_id)
                .eq("shop_id", shop_id)
                .execute()
            )
        )
        is_first = (count_resp.count or 0) == 0

        checkin_data: dict[str, Any] = {
            "user_id": user_id,
            "shop_id": shop_id,
            "photo_urls": photo_urls,
            "menu_photo_url": menu_photo_url,
            "note": note,
        }
        if stars is not None:
            checkin_data["stars"] = stars
            checkin_data["review_text"] = review_text
            checkin_data["confirmed_tags"] = confirmed_tags
            checkin_data["reviewed_at"] = datetime.now(timezone.utc).isoformat()  # noqa: UP017

        response = await asyncio.to_thread(
            lambda: self._db.table("check_ins").insert(checkin_data).execute()
        )
        rows = cast("list[dict[str, Any]]", response.data)
        row = first(rows, "create check-in")
        return CreateCheckInResponse(**row, is_first_checkin_at_shop=is_first)

    async def update_review(
        self,
        checkin_id: str,
        user_id: str,
        stars: int,
        review_text: str | None = None,
        confirmed_tags: list[str] | None = None,
    ) -> CheckIn:
        """Add or update a review on an existing check-in. Only the owner can update."""
        self._validate_stars(stars)
        if confirmed_tags:
            await self._validate_confirmed_tags(confirmed_tags)

        update_data: dict[str, Any] = {
            "stars": stars,
            "review_text": review_text,
            "reviewed_at": datetime.now(timezone.utc).isoformat(),  # noqa: UP017
        }
        if confirmed_tags is not None:
            update_data["confirmed_tags"] = confirmed_tags
        response = await asyncio.to_thread(
            lambda: (
                self._db.table("check_ins")
                .update(update_data)
                .eq("id", checkin_id)
                .eq("user_id", user_id)
                .execute()
            )
        )
        rows = cast("list[dict[str, Any]]", response.data)
        if not rows:
            raise ValueError("Check-in not found")
        return CheckIn(**rows[0])

    async def get_by_user(self, user_id: str) -> list[CheckInWithShop]:
        response = await asyncio.to_thread(
            lambda: (
                self._db.table("check_ins")
                .select("*, shops(name, mrt)")
                .eq("user_id", user_id)
                .order("created_at", desc=True)
                .execute()
            )
        )
        rows = cast("list[dict[str, Any]]", response.data)
        results = []
        for row in rows:
            shop_data = row.pop("shops", {}) or {}
            row["shop_name"] = shop_data.get("name")
            row["shop_mrt"] = shop_data.get("mrt")
            results.append(CheckInWithShop(**row))
        return results

    async def get_by_shop(self, shop_id: str) -> list[CheckIn]:
        response = await asyncio.to_thread(
            lambda: (
                self._db.table("check_ins")
                .select("*")
                .eq("shop_id", shop_id)
                .order("created_at", desc=True)
                .execute()
            )
        )
        rows = cast("list[dict[str, Any]]", response.data)
        return [CheckIn(**row) for row in rows]
