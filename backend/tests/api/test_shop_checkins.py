from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from api.deps import get_optional_user
from main import app

client = TestClient(app)


class TestShopCheckinsAPI:
    def test_authenticated_user_sees_full_checkin_data(self):
        """Logged-in user gets list of check-in summaries with display names."""
        app.dependency_overrides[get_optional_user] = lambda: {"id": "user-1"}
        try:
            with patch("api.shops.get_admin_db") as mock_admin:
                mock_db = MagicMock()
                mock_admin.return_value = mock_db
                mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
                    data=[
                        {
                            "id": "ci-1",
                            "user_id": "user-2",
                            "photo_urls": [
                                "https://example.com/p1.jpg",
                                "https://example.com/p2.jpg",
                            ],
                            "note": "Great latte",
                            "created_at": "2026-03-01T10:00:00Z",
                            "profiles": {"display_name": "小明"},
                        }
                    ]
                )
                response = client.get("/shops/shop-1/checkins")
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            assert len(data) == 1
            assert data[0]["display_name"] == "小明"
            assert data[0]["photo_url"] == "https://example.com/p1.jpg"
            assert "photo_urls" not in data[0]
        finally:
            app.dependency_overrides.clear()

    def test_unauthenticated_user_sees_count_and_preview(self):
        """Anonymous visitor gets count + one representative photo only."""
        app.dependency_overrides[get_optional_user] = lambda: None
        try:
            with patch("api.shops.get_admin_db") as mock_admin:
                mock_db = MagicMock()
                mock_admin.return_value = mock_db
                mock_db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
                    count=5,
                    data=[{"photo_urls": ["https://example.com/latest.jpg"]}],
                )
                response = client.get("/shops/shop-1/checkins")
            assert response.status_code == 200
            data = response.json()
            assert data["count"] == 5
            assert data["preview_photo_url"] == "https://example.com/latest.jpg"
        finally:
            app.dependency_overrides.clear()

    def test_unauthenticated_empty_shop_returns_zero(self):
        """Shop with no check-ins returns count 0 and null preview."""
        app.dependency_overrides[get_optional_user] = lambda: None
        try:
            with patch("api.shops.get_admin_db") as mock_admin:
                mock_db = MagicMock()
                mock_admin.return_value = mock_db
                mock_db.table.return_value.select.return_value.eq.return_value.limit.return_value.execute.return_value = MagicMock(
                    count=0, data=[]
                )
                response = client.get("/shops/shop-1/checkins")
            assert response.status_code == 200
            assert response.json() == {"count": 0, "preview_photo_url": None}
        finally:
            app.dependency_overrides.clear()

    def test_limit_param_caps_results(self):
        """The limit query param restricts the number of returned check-ins."""
        app.dependency_overrides[get_optional_user] = lambda: {"id": "user-1"}
        try:
            with patch("api.shops.get_admin_db") as mock_admin:
                mock_db = MagicMock()
                mock_admin.return_value = mock_db
                mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.limit.return_value.execute.return_value = MagicMock(
                    data=[]
                )
                client.get("/shops/shop-1/checkins?limit=3")
                mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.limit.assert_called_with(
                    3
                )
        finally:
            app.dependency_overrides.clear()
