from typing import Any, cast

from postgrest.exceptions import APIError
from supabase import Client

from core.db import first
from models.types import List, ListItem, ListPin, ListWithItems, Shop


class ListsService:
    def __init__(self, db: Client):
        self._db = db

    async def get_by_user(self, user_id: str) -> list[ListWithItems]:
        response = (
            self._db.table("lists")
            .select("*, list_items(shop_id, added_at)")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        rows = cast("list[dict[str, Any]]", response.data)
        results = []
        for row in rows:
            items_data = row.pop("list_items", [])
            items = [ListItem(**item) for item in items_data]
            results.append(ListWithItems(**row, items=items))
        return results

    async def create(self, user_id: str, name: str) -> List:
        """Create a new list. DB trigger enforces max 3 lists per user."""
        try:
            response = self._db.table("lists").insert({"user_id": user_id, "name": name}).execute()
        except APIError as e:
            if "check_violation" in str(e) or "Maximum of 3 lists" in str(e):
                raise ValueError("Maximum of 3 lists allowed") from None
            raise
        rows = cast("list[dict[str, Any]]", response.data)
        return List(**first(rows, "create list"))

    async def rename(self, list_id: str, name: str) -> List:
        """Rename a list. RLS ensures only the owner can update.
        Raises ValueError if the list is not found or the caller doesn't own it.
        """
        response = (
            self._db.table("lists")
            .update({"name": name})
            .eq("id", list_id)
            .execute()
        )
        if not response.data:
            raise ValueError("List not found or access denied")
        rows = cast("list[dict[str, Any]]", response.data)
        return List(**rows[0])

    async def delete(self, list_id: str) -> None:
        """Delete a list. RLS ensures only the owner can delete.

        ON DELETE CASCADE on list_items handles child row cleanup.
        Raises ValueError if the list is not found or the caller doesn't own it.
        """
        response = self._db.table("lists").delete().eq("id", list_id).execute()
        if not response.data:
            raise ValueError("List not found or access denied")

    async def add_shop(self, list_id: str, shop_id: str) -> ListItem:
        """Add a shop to a list. RLS enforces ownership via parent list."""
        response = (
            self._db.table("list_items").insert({"list_id": list_id, "shop_id": shop_id}).execute()
        )
        rows = cast("list[dict[str, Any]]", response.data)
        return ListItem(**first(rows, "add shop to list"))

    async def get_list_shops(self, list_id: str) -> list[Shop]:
        """Get full shop data for all shops in a list.
        RLS on lists ensures only the owner's list is accessible.
        Raises ValueError if the list is not found or the caller doesn't own it.
        """
        list_check = self._db.table("lists").select("id").eq("id", list_id).execute()
        list_rows = cast("list[dict[str, Any]]", list_check.data)
        if not list_rows:
            raise ValueError("List not found or access denied")

        response = (
            self._db.table("list_items")
            .select("shop_id, added_at, shops(*)")
            .eq("list_id", list_id)
            .execute()
        )
        rows = cast("list[dict[str, Any]]", response.data)
        shops = []
        for row in rows:
            shop_data = row.get("shops")
            if shop_data:
                shops.append(Shop(**shop_data))
        return shops

    async def get_pins(self, user_id: str) -> list[ListPin]:
        """Return coordinates for all shops across the user's lists.
        Uses a join query: list_items -> shops for lat/lng.
        RLS on list_items filters to the authenticated user's lists.
        """
        response = (
            self._db.table("list_items")
            .select("list_id, shop_id, shops(latitude, longitude)")
            .execute()
        )
        rows = cast("list[dict[str, Any]]", response.data)
        pins = []
        for row in rows:
            shop_data = row.get("shops", {})
            if shop_data and shop_data.get("latitude") and shop_data.get("longitude"):
                pins.append(
                    ListPin(
                        list_id=row["list_id"],
                        shop_id=row["shop_id"],
                        lat=shop_data["latitude"],
                        lng=shop_data["longitude"],
                    )
                )
        return pins

    async def remove_shop(self, list_id: str, shop_id: str) -> None:
        """Remove a shop from a list. RLS enforces ownership via parent list.

        Raises ValueError if the item is not found or the caller doesn't own the list.
        """
        response = (
            self._db.table("list_items")
            .delete()
            .eq("list_id", list_id)
            .eq("shop_id", shop_id)
            .execute()
        )
        if not response.data:
            raise ValueError("List item not found or access denied")
