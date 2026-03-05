import asyncio
from typing import Any

from fastapi import APIRouter, Depends
from supabase import Client

from api.deps import get_current_user, get_user_db

router = APIRouter(prefix="/stamps", tags=["stamps"])


@router.get("/")
async def get_my_stamps(
    user: dict[str, Any] = Depends(get_current_user),  # noqa: B008
    db: Client = Depends(get_user_db),  # noqa: B008
) -> list[dict[str, Any]]:
    """Get current user's stamps with shop names. Auth required."""
    response = await asyncio.to_thread(
        lambda: db.table("stamps")
        .select("*, shops(name)")
        .eq("user_id", user["id"])
        .order("earned_at", desc=True)
        .execute()
    )
    results = []
    for row in response.data:
        shop_data = row.pop("shops", {}) or {}
        row["shop_name"] = shop_data.get("name")
        results.append(row)
    return results
