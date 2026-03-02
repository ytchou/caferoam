from typing import Any, cast

from postgrest.exceptions import APIError
from supabase import Client

from core.db import first
from models.types import List, ListItem


class ListsService:
    def __init__(self, db: Client):
        self._db = db

    async def get_by_user(self, user_id: str) -> list[List]:
        response = (
            self._db.table("lists")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .execute()
        )
        rows = cast("list[dict[str, Any]]", response.data)
        return [List(**row) for row in rows]

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
