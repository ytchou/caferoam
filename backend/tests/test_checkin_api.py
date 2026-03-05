from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from api.deps import get_current_user, get_user_db
from main import app
from tests.factories import make_checkin


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers():
    return {"Authorization": "Bearer test-token"}


class TestCreateCheckin:
    def _make_db(self, prior_count: int):
        """Build mock DB that returns prior_count existing check-ins, then inserts."""
        db = MagicMock()

        # We need two different table() calls to behave differently:
        # 1. Count query: select("id", count="exact").eq().eq().execute()
        # 2. Insert query: insert().execute()
        call_count = {"n": 0}

        def table_side_effect(name):
            mock = MagicMock()
            call_count["n"] += 1
            if call_count["n"] == 1:
                # First call: count query
                count_chain = mock.select.return_value.eq.return_value.eq.return_value
                count_chain.execute.return_value.count = prior_count
            else:
                # Second call: insert
                mock.insert.return_value.execute.return_value.data = [
                    make_checkin(id="ci-new", shop_id="shop-a")
                ]
            return mock

        db.table.side_effect = table_side_effect
        return db

    def test_first_checkin_at_shop_returns_true(self, client: TestClient, auth_headers: dict):
        db = self._make_db(prior_count=0)
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-123"}
        app.dependency_overrides[get_user_db] = lambda: db

        try:
            resp = client.post(
                "/checkins/",
                json={
                    "shop_id": "shop-a",
                    "photo_urls": ["https://example.com/photo.jpg"],
                },
                headers=auth_headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["is_first_checkin_at_shop"] is True
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_user_db, None)

    def test_repeat_checkin_at_shop_returns_false(self, client: TestClient, auth_headers: dict):
        db = self._make_db(prior_count=2)
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-123"}
        app.dependency_overrides[get_user_db] = lambda: db

        try:
            resp = client.post(
                "/checkins/",
                json={
                    "shop_id": "shop-a",
                    "photo_urls": ["https://example.com/photo.jpg"],
                },
                headers=auth_headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["is_first_checkin_at_shop"] is False
        finally:
            app.dependency_overrides.pop(get_current_user, None)
            app.dependency_overrides.pop(get_user_db, None)
