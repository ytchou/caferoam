from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from api.deps import get_current_user, get_user_db
from main import app

client = TestClient(app)


class TestCheckinsAPI:
    def test_create_checkin_requires_auth(self):
        response = client.post(
            "/checkins",
            json={
                "shop_id": "shop-1",
                "photo_urls": ["https://example.com/photo.jpg"],
            },
        )
        assert response.status_code == 401

    def test_get_user_checkins_requires_auth(self):
        response = client.get("/checkins")
        assert response.status_code == 401

    def test_create_checkin_without_photos_is_rejected(self):
        """When a user submits a check-in with no photos, the server rejects it with 400."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-coffee-explorer"}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        response = client.post(
            "/checkins/",
            json={
                "shop_id": "shop-taipei-yongkang",
                "photo_urls": [],
            },
        )
        assert response.status_code == 400
        assert "photo" in response.json()["detail"].lower()

    def test_create_checkin_with_valid_photo_records_check_in(self):
        """When a user submits a check-in with a photo, the response includes the check-in record."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-mei-ling"}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[
                {
                    "id": "ci-shida-001",
                    "user_id": "user-mei-ling",
                    "shop_id": "shop-taipei-shida",
                    "photo_urls": ["https://storage.supabase.co/checkins/flat-white.jpg"],
                    "menu_photo_url": None,
                    "note": None,
                    "stars": None,
                    "review_text": None,
                    "confirmed_tags": None,
                    "reviewed_at": None,
                    "created_at": "2026-03-05T10:00:00Z",
                }
            ]
        )
        response = client.post(
            "/checkins/",
            json={
                "shop_id": "shop-taipei-shida",
                "photo_urls": ["https://storage.supabase.co/checkins/flat-white.jpg"],
            },
        )
        assert response.status_code == 200
        assert response.json()["id"] == "ci-shida-001"
        assert response.json()["photo_urls"] == [
            "https://storage.supabase.co/checkins/flat-white.jpg"
        ]

    def test_create_checkin_with_review_records_rating_and_text(self):
        """When a user submits a check-in with a star rating, the response includes the review data."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-abc123"}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        mock_db.table.return_value.select.return_value.in_.return_value.execute.return_value = (
            MagicMock(data=[{"id": "wifi"}, {"id": "quiet"}, {"id": "good-coffee"}])
        )
        mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[
                {
                    "id": "ci-review-1",
                    "user_id": "user-abc123",
                    "shop_id": "shop-taipei-01",
                    "photo_urls": ["https://storage.supabase.co/checkins/latte-art.jpg"],
                    "menu_photo_url": None,
                    "note": "Great pour-over selection",
                    "stars": 4,
                    "review_text": "Excellent single-origin options with a cozy atmosphere",
                    "confirmed_tags": ["wifi", "quiet", "good-coffee"],
                    "reviewed_at": "2026-03-04T14:00:00Z",
                    "created_at": "2026-03-04T14:00:00Z",
                    "stamps": [],
                }
            ]
        )
        response = client.post(
            "/checkins/",
            json={
                "shop_id": "shop-taipei-01",
                "photo_urls": ["https://storage.supabase.co/checkins/latte-art.jpg"],
                "note": "Great pour-over selection",
                "stars": 4,
                "review_text": "Excellent single-origin options with a cozy atmosphere",
                "confirmed_tags": ["wifi", "quiet", "good-coffee"],
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert data["stars"] == 4
        assert data["review_text"] == "Excellent single-origin options with a cozy atmosphere"
        assert data["confirmed_tags"] == ["wifi", "quiet", "good-coffee"]

    def test_update_review_requires_auth(self):
        """An unauthenticated user cannot update a review on a check-in."""
        response = client.patch(
            "/checkins/ci-123/review",
            json={"stars": 5},
        )
        assert response.status_code == 401

    def test_update_review_success(self):
        """A user can add a review to their existing check-in via PATCH."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-abc123"}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        mock_db.table.return_value.select.return_value.in_.return_value.execute.return_value = (
            MagicMock(data=[{"id": "good-coffee"}, {"id": "cozy"}])
        )
        mock_db.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[
                {
                    "id": "ci-456",
                    "user_id": "user-abc123",
                    "shop_id": "shop-yongkang-01",
                    "photo_urls": ["https://storage.supabase.co/checkins/espresso.jpg"],
                    "menu_photo_url": None,
                    "note": None,
                    "stars": 5,
                    "review_text": "Best espresso in Taipei",
                    "confirmed_tags": ["good-coffee", "cozy"],
                    "reviewed_at": "2026-03-04T15:30:00Z",
                    "created_at": "2026-03-04T12:00:00Z",
                    "stamps": [],
                }
            ]
        )
        response = client.patch(
            "/checkins/ci-456/review",
            json={
                "stars": 5,
                "review_text": "Best espresso in Taipei",
                "confirmed_tags": ["good-coffee", "cozy"],
            },
        )
        assert response.status_code == 200
        assert response.json()["stars"] == 5
        assert response.json()["review_text"] == "Best espresso in Taipei"

    def test_update_review_with_unknown_tags_returns_400(self):
        """When a user submits unknown confirmed tags on update_review, they get 400."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-abc123"}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        mock_db.table.return_value.select.return_value.in_.return_value.execute.return_value = (
            MagicMock(data=[{"id": "wifi"}])
        )
        response = client.patch(
            "/checkins/ci-456/review",
            json={
                "stars": 4,
                "confirmed_tags": ["wifi", "nonexistent-tag"],
            },
        )
        assert response.status_code == 400
        assert "Unknown tag IDs" in response.json()["detail"]

    def test_update_review_not_found_returns_404(self):
        """When a user tries to update a non-existent check-in, they get 404."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-abc123"}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        mock_db.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[]
        )
        response = client.patch(
            "/checkins/ci-not-mine/review",
            json={"stars": 3},
        )
        assert response.status_code == 404

    def test_update_review_on_another_users_checkin_returns_404(self):
        """When user A tries to update user B's check-in, they get 404 (not leaked as 403)."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-mei-lin"}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        # update filtered by both check-in ID and user_id — returns empty if not owned
        mock_db.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[]
        )
        response = client.patch(
            "/checkins/ci-owned-by-chen-wei/review",
            json={"stars": 2},
        )
        assert response.status_code == 404


class TestGetMyCheckins:
    def test_checkins_include_shop_data(self):
        """When a user fetches their check-ins, each record includes shop_name and shop_mrt."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-123"}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        mock_db.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(
            data=[
                {
                    "id": "ci-1",
                    "user_id": "user-123",
                    "shop_id": "shop-a",
                    "photo_urls": ["https://example.com/photo1.jpg"],
                    "menu_photo_url": None,
                    "note": None,
                    "stars": 4,
                    "review_text": None,
                    "confirmed_tags": [],
                    "reviewed_at": None,
                    "created_at": "2026-03-01T00:00:00Z",
                    "shops": {"name": "Fika Coffee", "mrt": "Daan"},
                }
            ]
        )
        resp = client.get("/checkins")
        assert resp.status_code == 200
        data = resp.json()
        assert data[0]["shop_name"] == "Fika Coffee"
        assert data[0]["shop_mrt"] == "Daan"
