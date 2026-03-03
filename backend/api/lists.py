from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from supabase import Client

from api.deps import get_current_user, get_user_db
from models.types import ListPin
from services.lists_service import ListsService

router = APIRouter(prefix="/lists", tags=["lists"])


class CreateListRequest(BaseModel):
    name: str


class AddShopRequest(BaseModel):
    shop_id: str


class RenameListRequest(BaseModel):
    name: str


@router.get("/")
async def get_my_lists(
    user: dict[str, Any] = Depends(get_current_user),  # noqa: B008
    db: Client = Depends(get_user_db),  # noqa: B008
) -> list[dict[str, Any]]:
    """Get current user's lists. Auth required."""
    service = ListsService(db=db)
    results = await service.get_by_user(user["id"])
    return [r.model_dump() for r in results]


@router.post("/")
async def create_list(
    body: CreateListRequest,
    user: dict[str, Any] = Depends(get_current_user),  # noqa: B008
    db: Client = Depends(get_user_db),  # noqa: B008
) -> dict[str, Any]:
    """Create a new list. Auth required. Max 3 lists per user."""
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="List name cannot be empty")
    service = ListsService(db=db)
    try:
        result = await service.create(user_id=user["id"], name=body.name.strip())
        return result.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from None


@router.get("/pins")
async def get_list_pins(
    user: dict[str, Any] = Depends(get_current_user),  # noqa: B008
    db: Client = Depends(get_user_db),  # noqa: B008
) -> list[dict[str, Any]]:
    """Get map pins (coordinates) for all shops in the user's lists."""
    service = ListsService(db=db)
    results = await service.get_pins()
    return [r.model_dump() for r in results]


@router.delete("/{list_id}")
async def delete_list(
    list_id: str,
    user: dict[str, Any] = Depends(get_current_user),  # noqa: B008
    db: Client = Depends(get_user_db),  # noqa: B008
) -> dict[str, bool]:
    """Delete a list. Auth required."""
    service = ListsService(db=db)
    try:
        await service.delete(list_id=list_id)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e)) from None


@router.patch("/{list_id}")
async def rename_list(
    list_id: str,
    body: RenameListRequest,
    user: dict[str, Any] = Depends(get_current_user),  # noqa: B008
    db: Client = Depends(get_user_db),  # noqa: B008
) -> dict[str, Any]:
    """Rename a list. Auth required."""
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="List name cannot be empty")
    service = ListsService(db=db)
    try:
        result = await service.rename(list_id=list_id, name=body.name.strip())
        return result.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e)) from None


@router.get("/{list_id}/shops")
async def get_list_shops(
    list_id: str,
    user: dict[str, Any] = Depends(get_current_user),  # noqa: B008
    db: Client = Depends(get_user_db),  # noqa: B008
) -> list[dict[str, Any]]:
    """Get full shop data for shops in a list. Auth required."""
    service = ListsService(db=db)
    try:
        results = await service.get_list_shops(list_id=list_id)
        return [r.model_dump() for r in results]
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e)) from None


@router.post("/{list_id}/shops")
async def add_shop_to_list(
    list_id: str,
    body: AddShopRequest,
    user: dict[str, Any] = Depends(get_current_user),  # noqa: B008
    db: Client = Depends(get_user_db),  # noqa: B008
) -> dict[str, Any]:
    """Add a shop to a list. Auth required."""
    service = ListsService(db=db)
    try:
        result = await service.add_shop(list_id=list_id, shop_id=body.shop_id)
        return result.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e)) from None


@router.delete("/{list_id}/shops/{shop_id}")
async def remove_shop_from_list(
    list_id: str,
    shop_id: str,
    user: dict[str, Any] = Depends(get_current_user),  # noqa: B008
    db: Client = Depends(get_user_db),  # noqa: B008
) -> dict[str, bool]:
    """Remove a shop from a list. Auth required."""
    service = ListsService(db=db)
    try:
        await service.remove_shop(list_id=list_id, shop_id=shop_id)
        return {"ok": True}
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e)) from None
