from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from api.deps import get_admin_db, get_current_user, get_user_db
from main import app

client = TestClient(app)


def _auth_overrides(user_id: str = "user-1") -> MagicMock:
    """Set up dependency overrides for an authenticated user. Returns the mock db client."""
    mock_db = MagicMock()
    # Chain: table().update().eq().is_().execute()
    #         table().select().eq().single().execute()
    mock_db.table.return_value = mock_db
    mock_db.update.return_value = mock_db
    mock_db.select.return_value = mock_db
    mock_db.eq.return_value = mock_db
    mock_db.is_.return_value = mock_db
    mock_db.single.return_value = mock_db
    mock_admin_db = MagicMock()
    app.dependency_overrides[get_current_user] = lambda: {"id": user_id}
    app.dependency_overrides[get_user_db] = lambda: mock_db
    app.dependency_overrides[get_admin_db] = lambda: mock_admin_db
    return mock_db


def _clear_overrides() -> None:
    app.dependency_overrides.clear()


class TestConsentRoute:
    def test_consent_sets_pdpa_timestamp(self):
        mock_db = _auth_overrides()
        mock_db.execute.return_value = MagicMock(
            data=[{"id": "user-1", "pdpa_consent_at": "2026-02-25T00:00:00+00:00"}]
        )
        try:
            response = client.post("/auth/consent")
            assert response.status_code == 200
            data = response.json()
            assert "pdpa_consent_at" in data
            mock_db.table.assert_called_with("profiles")
        finally:
            _clear_overrides()

    def test_consent_rejects_unauthenticated(self):
        response = client.post("/auth/consent")
        assert response.status_code == 401

    def test_consent_is_idempotent(self):
        """Re-posting consent returns 200 and preserves the original timestamp."""
        mock_db = _auth_overrides()
        # First call: update returns empty (consent already set)
        # Second call: select.single returns existing profile
        mock_db.execute.side_effect = [
            MagicMock(data=[]),  # update found no null pdpa_consent_at row
            MagicMock(data={"id": "user-1", "pdpa_consent_at": "2026-02-25T00:00:00+00:00"}),
        ]
        try:
            response = client.post("/auth/consent")
            assert response.status_code == 200
            data = response.json()
            assert data["pdpa_consent_at"] == "2026-02-25T00:00:00+00:00"
        finally:
            _clear_overrides()


class TestDeleteAccountRoute:
    def test_delete_account_sets_deletion_timestamp(self):
        mock_db = _auth_overrides()
        mock_db.execute.return_value = MagicMock(
            data=[{"id": "user-1", "deletion_requested_at": "2026-02-25T00:00:00+00:00"}]
        )
        try:
            response = client.delete("/auth/account")
            assert response.status_code == 200
            data = response.json()
            assert "deletion_requested_at" in data
            mock_db.table.assert_called_with("profiles")
        finally:
            _clear_overrides()

    def test_delete_account_rejects_unauthenticated(self):
        response = client.delete("/auth/account")
        assert response.status_code == 401

    def test_delete_account_no_op_when_already_pending(self):
        """Calling DELETE /account again does not reset the grace period timer."""
        mock_db = _auth_overrides()
        original_ts = "2026-02-25T00:00:00+00:00"
        # Update finds no null deletion_requested_at row (already pending)
        mock_db.execute.side_effect = [
            MagicMock(data=[]),  # update no-op
            MagicMock(data={"id": "user-1", "deletion_requested_at": original_ts}),
        ]
        try:
            response = client.delete("/auth/account")
            assert response.status_code == 200
            data = response.json()
            assert data["deletion_requested_at"] == original_ts
        finally:
            _clear_overrides()


class TestSoftDeleteGate:
    def test_given_user_pending_deletion_when_making_authenticated_request_then_403(self):
        """Any authenticated request from a soft-deleted user must return 403.
        Gate uses DB lookup, not JWT claims — JWT claims are unreliable for this field."""
        mock_profile_response = MagicMock()
        mock_profile_response.data = {"deletion_requested_at": "2026-03-15T16:00:00+00:00"}

        mock_service_db = MagicMock()
        (
            mock_service_db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value
        ) = mock_profile_response

        with (
            patch("api.deps.pyjwt.decode", return_value={"sub": "user-being-deleted"}),
            patch("api.deps._jwks_client") as mock_jwks,
            patch("api.deps.get_service_role_client", return_value=mock_service_db),
        ):
            mock_jwks.get_signing_key_from_jwt.return_value = MagicMock()
            response = client.get("/profile", headers={"Authorization": "Bearer fake-jwt"})

        assert response.status_code == 403
        assert "pending deletion" in response.json()["detail"]

    def test_given_user_not_pending_deletion_when_calling_get_current_user_then_returns_user(self):
        """Users with no pending deletion pass through the auth gate and get their user dict."""
        mock_profile_response = MagicMock()
        mock_profile_response.data = {"deletion_requested_at": None}

        mock_service_db = MagicMock()
        (
            mock_service_db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value
        ) = mock_profile_response

        with (
            patch("api.deps.pyjwt.decode", return_value={"sub": "active-user"}),
            patch("api.deps._jwks_client") as mock_jwks,
            patch("api.deps.get_service_role_client", return_value=mock_service_db),
        ):
            mock_jwks.get_signing_key_from_jwt.return_value = MagicMock()
            from api.deps import get_current_user

            result = get_current_user("fake-jwt")

        assert result == {"id": "active-user"}


class TestCancelDeletionRoute:
    def test_cancel_deletion_clears_timestamp(self):
        mock_db = _auth_overrides()
        # First call (select+single) returns profile with deletion_requested_at set
        # Second call (update) returns the cleared profile
        mock_db.execute.side_effect = [
            MagicMock(data={"id": "user-1", "deletion_requested_at": "2026-02-25T00:00:00+00:00"}),
            MagicMock(data=[{"id": "user-1", "deletion_requested_at": None}]),
        ]
        try:
            response = client.post("/auth/cancel-deletion")
            assert response.status_code == 200
            data = response.json()
            assert data["deletion_requested_at"] is None
        finally:
            _clear_overrides()

    def test_cancel_deletion_404_when_not_pending(self):
        mock_db = _auth_overrides()
        # Select+single returns profile with no deletion_requested_at
        mock_db.execute.return_value = MagicMock(
            data={"id": "user-1", "deletion_requested_at": None}
        )
        try:
            response = client.post("/auth/cancel-deletion")
            assert response.status_code == 404
            assert "not pending" in response.json()["detail"].lower()
        finally:
            _clear_overrides()
