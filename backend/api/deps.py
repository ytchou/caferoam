from typing import Any

from fastapi import Depends, HTTPException, Request, status
from supabase import Client

from core.config import settings
from db.supabase_client import get_user_client


def _get_bearer_token(request: Request) -> str:
    """Extract Bearer token from Authorization header. Raises 401 if missing or malformed."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    return auth_header.removeprefix("Bearer ")


async def get_user_db(token: str = Depends(_get_bearer_token)) -> Client:  # noqa: B008
    """Return an authenticated Supabase client for the current request.

    This client has auth.uid() set in PostgREST, so RLS policies
    automatically enforce row-level ownership.
    """
    return get_user_client(token)


async def get_current_user(token: str = Depends(_get_bearer_token)) -> dict[str, Any]:  # noqa: B008
    """Validate JWT and return the authenticated user. Raises 401 if invalid."""
    try:
        client = get_user_client(token)
        response = client.auth.get_user(token)
        if response is None or response.user is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        return {"id": response.user.id}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None


def require_admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:  # noqa: B008
    """Raise 403 if the authenticated user is not in the admin allowlist."""
    if user["id"] not in settings.admin_user_ids:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


async def get_optional_user(request: Request) -> dict[str, Any] | None:
    """Same as get_current_user but returns None instead of raising for unauthenticated."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.removeprefix("Bearer ")
    try:
        client = get_user_client(token)
        response = client.auth.get_user(token)
        if response is None or response.user is None:
            return None
        return {"id": response.user.id}
    except Exception:
        return None
