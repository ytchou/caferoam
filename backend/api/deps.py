from typing import Any

import jwt as pyjwt
import structlog
from fastapi import Depends, HTTPException, Request, status
from jwt import PyJWKClient
from supabase import Client

from core.config import settings
from db.supabase_client import get_service_role_client, get_user_client

logger = structlog.get_logger()

# Fetches the public key set once and caches for 5 minutes.
# Works with HS256 (legacy), RS256, or ES256 — determined by the `kid` in the JWT header.
_jwks_client = PyJWKClient(
    f"{settings.supabase_url}/auth/v1/.well-known/jwks.json",
    cache_keys=True,
)


def _get_bearer_token(request: Request) -> str:
    """Extract Bearer token from Authorization header. Raises 401 if missing or malformed."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid Authorization header",
        )
    return auth_header.removeprefix("Bearer ")


def get_admin_db() -> Client:
    """Return a service-role Supabase client (bypasses RLS).
    Use only for admin operations that require elevated privileges."""
    return get_service_role_client()


async def get_user_db(token: str = Depends(_get_bearer_token)) -> Client:  # noqa: B008
    """Return an authenticated Supabase client for the current request.

    This client has auth.uid() set in PostgREST, so RLS policies
    automatically enforce row-level ownership.
    """
    return get_user_client(token)


def get_current_user(token: str = Depends(_get_bearer_token)) -> dict[str, Any]:  # noqa: B008
    """Validate JWT and return the authenticated user. Raises 401 if invalid.

    Verifies the signature via Supabase's JWKS endpoint (cached). Supports
    ES256, RS256, and HS256 — whichever algorithm the Supabase instance uses.
    """
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256", "HS256"],
            options={"verify_aud": False},
        )
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token: missing user ID",
            )
        # Check deletion status from DB — JWT app_metadata.deletion_requested is
        # unreliable (local Supabase injects False defaults; prod claims can be stale).
        # DB check also blocks mid-session access, not just new logins.
        service_db = get_service_role_client()
        profile = (
            service_db.table("profiles")
            .select("deletion_requested_at")
            .eq("id", user_id)
            .single()
            .execute()
        )
        if isinstance(profile.data, dict) and profile.data.get("deletion_requested_at") is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is pending deletion",
            )
        return {"id": user_id}
    except HTTPException:
        raise
    except pyjwt.InvalidTokenError as exc:
        logger.warning("JWT validation failed", error_type=type(exc).__name__, detail=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None
    except Exception as exc:
        logger.warning("JWT validation error", error_type=type(exc).__name__, detail=str(exc))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from None


def require_admin(user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:  # noqa: B008
    """Raise 403 if the authenticated user is not in the admin allowlist."""
    if user["id"] not in settings.admin_user_ids:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def get_optional_user(request: Request) -> dict[str, Any] | None:
    """Same as get_current_user but returns None instead of raising for unauthenticated."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return None

    token = auth_header.removeprefix("Bearer ")
    try:
        signing_key = _jwks_client.get_signing_key_from_jwt(token)
        payload = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256", "HS256"],
            options={"verify_aud": False},
        )
        user_id: str | None = payload.get("sub")
        return {"id": user_id} if user_id else None
    except Exception:
        return None
