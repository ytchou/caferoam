from typing import Any, cast

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query

from api.deps import require_admin
from db.supabase_client import get_service_role_client
from middleware.admin_audit import log_admin_action

logger = structlog.get_logger()

router = APIRouter(prefix="/admin/pipeline", tags=["admin"])


@router.get("/overview")
async def pipeline_overview(
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, Any]:
    """Job counts by status, recent submissions."""
    db = get_service_role_client()

    # Count jobs by status — single GROUP BY query instead of N+1
    counts_response = db.rpc("job_queue_counts_by_status", {}).execute()
    counts_data = cast("list[dict[str, Any]]", counts_response.data or [])
    job_counts: dict[str, int] = {row["status"]: int(row["count"]) for row in counts_data}

    # Recent submissions
    subs_response = (
        db.table("shop_submissions").select("*").order("created_at", desc=True).limit(20).execute()
    )

    return {
        "job_counts": job_counts,
        "recent_submissions": subs_response.data,
    }


@router.get("/submissions")
async def list_submissions(
    status: str | None = None,
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> list[dict[str, Any]]:
    """List shop submissions, optionally filtered by status."""
    db = get_service_role_client()
    query = db.table("shop_submissions").select("*").order("created_at", desc=True).limit(50)
    if status:
        query = query.eq("status", status)
    response = query.execute()
    return cast("list[dict[str, Any]]", response.data)


@router.get("/dead-letter")
async def dead_letter_jobs(
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> list[dict[str, Any]]:
    """Failed jobs for investigation."""
    db = get_service_role_client()
    response = (
        db.table("job_queue")
        .select("*")
        .in_("status", ["failed", "dead_letter"])
        .order("created_at", desc=True)
        .limit(50)
        .execute()
    )
    return cast("list[dict[str, Any]]", response.data)


@router.post("/retry/{job_id}")
async def retry_job(
    job_id: str,
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, str]:
    """Manually retry a failed/dead-letter job."""
    db = get_service_role_client()

    job_response = db.table("job_queue").select("id, status").eq("id", job_id).execute()
    if not job_response.data:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    job_status = cast("list[dict[str, Any]]", job_response.data)[0]["status"]
    if job_status not in ("failed", "dead_letter"):
        raise HTTPException(
            status_code=409,
            detail=f"Job {job_id} is not retryable (status: {job_status})",
        )

    db.table("job_queue").update({"status": "pending", "attempts": 0, "last_error": None}).eq(
        "id", job_id
    ).execute()
    log_admin_action(
        admin_user_id=user["id"],
        action=f"POST /admin/pipeline/retry/{job_id}",
        target_type="job",
        target_id=job_id,
    )
    return {"message": f"Job {job_id} re-queued"}


@router.post("/reject/{submission_id}")
async def reject_submission(
    submission_id: str,
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, str]:
    """Reject a submission and remove the associated shop."""
    db = get_service_role_client()

    sub_response = db.table("shop_submissions").select("shop_id").eq("id", submission_id).execute()
    if not sub_response.data:
        raise HTTPException(status_code=404, detail=f"Submission {submission_id} not found")
    sub_data = cast("dict[str, Any]", sub_response.data[0])
    shop_id = sub_data.get("shop_id")

    db.table("shop_submissions").update(
        {"status": "failed", "failure_reason": "Rejected by admin"}
    ).eq("id", submission_id).execute()

    if shop_id:
        # Cancel in-flight jobs for this shop (JSONB payload filter)
        db.rpc(
            "cancel_shop_jobs",
            {"p_shop_id": str(shop_id), "p_reason": "Submission rejected by admin"},
        ).execute()
        db.table("shops").delete().eq("id", shop_id).execute()

    log_admin_action(
        admin_user_id=user["id"],
        action=f"POST /admin/pipeline/reject/{submission_id}",
        target_type="submission",
        target_id=submission_id,
        payload={"shop_id": str(shop_id) if shop_id else None},
    )
    return {"message": f"Submission {submission_id} rejected"}


@router.get("/jobs")
async def list_jobs(
    status: str | None = None,
    job_type: str | None = None,
    offset: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, Any]:
    """List all jobs with optional filters."""
    db = get_service_role_client()
    query = db.table("job_queue").select("*", count="exact")
    if status:
        query = query.eq("status", status)
    if job_type:
        query = query.eq("job_type", job_type)
    query = query.order("created_at", desc=True).range(offset, offset + limit - 1)
    response = query.execute()
    return {
        "jobs": cast("list[dict[str, Any]]", response.data),
        "total": response.count or 0,
    }


@router.post("/jobs/{job_id}/cancel")
async def cancel_job(
    job_id: str,
    user: dict[str, Any] = Depends(require_admin),  # noqa: B008
) -> dict[str, str]:
    """Cancel a pending or claimed job."""
    db = get_service_role_client()

    job_response = db.table("job_queue").select("id, status").eq("id", job_id).execute()
    if not job_response.data:
        raise HTTPException(status_code=404, detail=f"Job {job_id} not found")

    job_status = cast("list[dict[str, Any]]", job_response.data)[0]["status"]
    if job_status not in ("pending", "claimed"):
        raise HTTPException(
            status_code=409,
            detail=f"Job {job_id} cannot be cancelled (status: {job_status})",
        )

    # Conditional update: only succeeds if job is still in a cancellable state
    update_response = (
        db.table("job_queue")
        .update({"status": "dead_letter", "last_error": "Cancelled by admin"})
        .eq("id", job_id)
        .in_("status", ["pending", "claimed"])
        .execute()
    )
    if not update_response.data:
        raise HTTPException(
            status_code=409,
            detail=f"Job {job_id} could not be cancelled — it may have already completed",
        )

    log_admin_action(
        admin_user_id=user["id"],
        action=f"POST /admin/pipeline/jobs/{job_id}/cancel",
        target_type="job",
        target_id=job_id,
    )
    return {"message": f"Job {job_id} cancelled"}
