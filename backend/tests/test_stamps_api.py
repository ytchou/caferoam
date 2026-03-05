from unittest.mock import MagicMock

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


class TestGetStamps:
    def test_stamps_include_shop_name(self, client: TestClient, auth_headers: dict):
        db = MagicMock()
        db.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value.data = [
            {
                "id": "stamp-1",
                "user_id": "user-123",
                "shop_id": "shop-a",
                "check_in_id": "ci-1",
                "design_url": "/stamps/shop-a.svg",
                "earned_at": "2026-03-01T00:00:00Z",
                "shops": {"name": "Fika Coffee"},
            }
        ]

        app.dependency_overrides[get_current_user] = lambda: {"id": "user-123"}
        app.dependency_overrides[get_user_db] = lambda: db

        try:
            resp = client.get("/stamps", headers=auth_headers)
            assert resp.status_code == 200
            data = resp.json()
            assert data[0]["shop_name"] == "Fika Coffee"
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_user_db, None)
