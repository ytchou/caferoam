from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from api.deps import get_current_user, get_user_db
from main import app


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer test-token"}


class TestGetProfile:
    def test_returns_profile_data(self, client: TestClient, auth_headers: dict):
        db = MagicMock()
        # Profile query: .table().select().eq().single().execute()
        db.table.return_value.select.return_value.eq.return_value.single.return_value.execute.return_value.data = {
            "display_name": "Mei-Ling",
            "avatar_url": None,
        }
        # Count queries: .table().select().eq().execute() — stamp_count and checkin_count
        db.table.return_value.select.return_value.eq.return_value.execute.return_value.count = 5

        app.dependency_overrides[get_current_user] = lambda: {"id": "user-123"}
        app.dependency_overrides[get_user_db] = lambda: db
        try:
            resp = client.get("/profile", headers=auth_headers)
            assert resp.status_code == 200
            data = resp.json()
            assert data["display_name"] == "Mei-Ling"
            assert "stamp_count" in data
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_user_db, None)

    def test_returns_401_without_auth(self, client: TestClient):
        resp = client.get("/profile")
        assert resp.status_code in (401, 422)


class TestPatchProfile:
    def test_updates_display_name(self, client: TestClient, auth_headers: dict):
        db = MagicMock()
        db.table.return_value.update.return_value.eq.return_value.execute.return_value.data = [
            {"display_name": "New Name"}
        ]

        app.dependency_overrides[get_current_user] = lambda: {"id": "user-123"}
        app.dependency_overrides[get_user_db] = lambda: db
        try:
            resp = client.patch(
                "/profile",
                json={"display_name": "New Name"},
                headers=auth_headers,
            )
            assert resp.status_code == 200
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_user_db, None)

    def test_rejects_long_display_name(self, client: TestClient, auth_headers: dict):
        db = MagicMock()

        app.dependency_overrides[get_current_user] = lambda: {"id": "user-123"}
        app.dependency_overrides[get_user_db] = lambda: db
        try:
            resp = client.patch(
                "/profile",
                json={"display_name": "x" * 31},
                headers=auth_headers,
            )
            assert resp.status_code == 422  # Pydantic validation
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_user_db, None)
