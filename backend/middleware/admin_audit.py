from typing import Any

import structlog

from db.supabase_client import get_service_role_client

logger = structlog.get_logger()


def log_admin_action(
    admin_user_id: str,
    action: str,
    target_type: str,
    target_id: str | None = None,
    payload: dict[str, Any] | None = None,
) -> None:
    """Log an admin action to the audit trail. Fire-and-forget — never raises."""
    try:
        db = get_service_role_client()
        db.table("admin_audit_logs").insert(
            {
                "admin_user_id": admin_user_id,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
                "payload": payload,
            }
        ).execute()
    except Exception:
        logger.warning("Failed to write audit log", action=action, exc_info=True)
