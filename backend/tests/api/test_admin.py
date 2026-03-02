from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from api.deps import get_current_user
from main import app

client = TestClient(app)

_ADMIN_ID = "admin-user-id"


def _admin_user():
    return {"id": _ADMIN_ID}


def test_unauthenticated_user_cannot_access_pipeline_overview():
    response = client.get("/admin/pipeline/overview")
    assert response.status_code in (401, 403)


def test_non_admin_user_is_blocked_from_pipeline_overview():
    """Non-admin users should get 403."""
    app.dependency_overrides[get_current_user] = lambda: {"id": "regular-user"}
    try:
        mock_db = MagicMock()
        with (
            patch("api.admin.get_service_role_client", return_value=mock_db),
            patch("api.deps.settings") as mock_settings,
        ):
            mock_settings.admin_user_ids = [_ADMIN_ID]
            response = client.get("/admin/pipeline/overview")
        assert response.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_admin_sees_job_counts_and_recent_submissions():
    app.dependency_overrides[get_current_user] = _admin_user
    try:
        mock_db = MagicMock()
        mock_eq = mock_db.table.return_value.select.return_value.eq.return_value
        mock_eq.execute.return_value = MagicMock(data=[], count=0)
        mock_order = mock_db.table.return_value.select.return_value.order.return_value
        mock_order.limit.return_value.execute.return_value = MagicMock(data=[])
        with (
            patch("api.admin.get_service_role_client", return_value=mock_db),
            patch("api.deps.settings") as mock_settings,
        ):
            mock_settings.admin_user_ids = [_ADMIN_ID]
            response = client.get("/admin/pipeline/overview")
        assert response.status_code == 200
        data = response.json()
        assert "job_counts" in data
        assert "recent_submissions" in data
    finally:
        app.dependency_overrides.clear()


def test_retrying_failed_job_re_enqueues_it():
    app.dependency_overrides[get_current_user] = _admin_user
    try:
        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            MagicMock(data=[{"id": "job-1", "status": "failed"}])
        )
        with (
            patch("api.admin.get_service_role_client", return_value=mock_db),
            patch("middleware.admin_audit.get_service_role_client", return_value=mock_db),
            patch("api.deps.settings") as mock_settings,
        ):
            mock_settings.admin_user_ids = [_ADMIN_ID]
            response = client.post("/admin/pipeline/retry/job-1")
        assert response.status_code == 200
        assert "re-queued" in response.json()["message"]
    finally:
        app.dependency_overrides.clear()


def test_retrying_nonexistent_job_returns_404():
    app.dependency_overrides[get_current_user] = _admin_user
    try:
        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            MagicMock(data=[])
        )
        with (
            patch("api.admin.get_service_role_client", return_value=mock_db),
            patch("api.deps.settings") as mock_settings,
        ):
            mock_settings.admin_user_ids = [_ADMIN_ID]
            response = client.post("/admin/pipeline/retry/missing-job")
        assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()


def test_retrying_completed_job_returns_409():
    app.dependency_overrides[get_current_user] = _admin_user
    try:
        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            MagicMock(data=[{"id": "job-2", "status": "completed"}])
        )
        with (
            patch("api.admin.get_service_role_client", return_value=mock_db),
            patch("api.deps.settings") as mock_settings,
        ):
            mock_settings.admin_user_ids = [_ADMIN_ID]
            response = client.post("/admin/pipeline/retry/job-2")
        assert response.status_code == 409
    finally:
        app.dependency_overrides.clear()


def test_rejecting_submission_removes_the_associated_shop():
    app.dependency_overrides[get_current_user] = _admin_user
    try:
        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            MagicMock(data=[{"shop_id": "shop-1"}])
        )
        with (
            patch("api.admin.get_service_role_client", return_value=mock_db),
            patch("middleware.admin_audit.get_service_role_client", return_value=mock_db),
            patch("api.deps.settings") as mock_settings,
        ):
            mock_settings.admin_user_ids = [_ADMIN_ID]
            response = client.post("/admin/pipeline/reject/sub-1")
        assert response.status_code == 200
        assert "rejected" in response.json()["message"]
        # Verify shop deletion was triggered
        mock_db.table.return_value.delete.return_value.eq.assert_called_once()
    finally:
        app.dependency_overrides.clear()


def test_rejecting_nonexistent_submission_returns_404():
    app.dependency_overrides[get_current_user] = _admin_user
    try:
        mock_db = MagicMock()
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = (
            MagicMock(data=[])
        )
        with (
            patch("api.admin.get_service_role_client", return_value=mock_db),
            patch("api.deps.settings") as mock_settings,
        ):
            mock_settings.admin_user_ids = [_ADMIN_ID]
            response = client.post("/admin/pipeline/reject/missing-sub")
        assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()


class TestAdminJobsList:
    def test_admin_can_list_all_jobs_with_pagination(self):
        """Admin can list all jobs with pagination."""
        app.dependency_overrides[get_current_user] = _admin_user
        try:
            mock_db = MagicMock()
            select_rv = mock_db.table.return_value.select.return_value
            select_rv.order.return_value.range.return_value.execute.return_value = MagicMock(
                data=[{"id": "job-1", "job_type": "enrich_shop", "status": "pending"}],
                count=1,
            )
            with (
                patch("api.admin.get_service_role_client", return_value=mock_db),
                patch("api.deps.settings") as mock_settings,
            ):
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.get("/admin/pipeline/jobs")
            assert response.status_code == 200
            data = response.json()
            assert "jobs" in data
        finally:
            app.dependency_overrides.clear()

    def test_admin_can_filter_jobs_by_status_and_type(self):
        """Admin can filter jobs by status and job_type."""
        app.dependency_overrides[get_current_user] = _admin_user
        try:
            mock_db = MagicMock()
            select_rv = mock_db.table.return_value.select.return_value
            eq2_rv = select_rv.eq.return_value.eq.return_value
            eq2_rv.order.return_value.range.return_value.execute.return_value = MagicMock(
                data=[],
                count=0,
            )
            with (
                patch("api.admin.get_service_role_client", return_value=mock_db),
                patch("api.deps.settings") as mock_settings,
            ):
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.get("/admin/pipeline/jobs?status=failed&job_type=enrich_shop")
            assert response.status_code == 200
        finally:
            app.dependency_overrides.clear()


class TestAdminJobCancel:
    def test_admin_can_cancel_a_pending_job(self):
        """Admin can cancel a pending job."""
        app.dependency_overrides[get_current_user] = _admin_user
        try:
            mock_db = MagicMock()
            mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = (
                MagicMock(data=[{"id": "job-1", "status": "pending"}])
            )
            mock_db.table.return_value.update.return_value.eq.return_value.in_.return_value.execute.return_value = (
                MagicMock(data=[{"id": "job-1", "status": "dead_letter"}])
            )
            with (
                patch("api.admin.get_service_role_client", return_value=mock_db),
                patch("middleware.admin_audit.get_service_role_client", return_value=mock_db),
                patch("api.deps.settings") as mock_settings,
            ):
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.post("/admin/pipeline/jobs/job-1/cancel")
            assert response.status_code == 200
            assert "cancelled" in response.json()["message"].lower()
        finally:
            app.dependency_overrides.clear()

    def test_completed_job_cannot_be_cancelled(self):
        """Completed jobs cannot be cancelled — returns 409."""
        app.dependency_overrides[get_current_user] = _admin_user
        try:
            mock_db = MagicMock()
            mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = (
                MagicMock(data=[{"id": "job-1", "status": "completed"}])
            )
            with (
                patch("api.admin.get_service_role_client", return_value=mock_db),
                patch("api.deps.settings") as mock_settings,
            ):
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.post("/admin/pipeline/jobs/job-1/cancel")
            assert response.status_code == 409
        finally:
            app.dependency_overrides.clear()
