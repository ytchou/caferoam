from unittest.mock import AsyncMock, MagicMock, patch

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

    def test_create_checkin_empty_photos_returns_400(self):
        """Empty photo_urls must return 400, not 500 (ValueError caught in route)."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-1"}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        try:
            with patch("api.checkins.CheckInService") as mock_cls:
                mock_svc = AsyncMock()
                mock_svc.create.side_effect = ValueError(
                    "At least one photo is required for check-in"
                )
                mock_cls.return_value = mock_svc
                response = client.post(
                    "/checkins/",
                    json={
                        "shop_id": "shop-1",
                        "photo_urls": [],
                    },
                )
            assert response.status_code == 400
            assert "photo" in response.json()["detail"].lower()
        finally:
            app.dependency_overrides.clear()

    def test_create_checkin_uses_user_db(self):
        """Route must use per-request JWT client, not anon singleton."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-1"}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        try:
            with patch("api.checkins.CheckInService") as mock_cls:
                mock_svc = AsyncMock()
                mock_svc.create.return_value = MagicMock(model_dump=lambda: {"id": "ci-1"})
                mock_cls.return_value = mock_svc
                client.post(
                    "/checkins/",
                    json={
                        "shop_id": "shop-1",
                        "photo_urls": ["https://example.com/photo.jpg"],
                    },
                )
                # Verify service was constructed with the user's DB client
                mock_cls.assert_called_once_with(db=mock_db)
        finally:
            app.dependency_overrides.clear()

    def test_create_checkin_with_review_passes_review_fields_to_service(self):
        """When a user submits a check-in with a review, the review fields are forwarded to the service."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-abc123"}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        try:
            with patch("api.checkins.CheckInService") as mock_cls:
                mock_svc = AsyncMock()
                mock_svc.create.return_value = MagicMock(
                    model_dump=lambda: {"id": "ci-review-1"}
                )
                mock_cls.return_value = mock_svc
                response = client.post(
                    "/checkins/",
                    json={
                        "shop_id": "shop-taipei-01",
                        "photo_urls": ["https://storage.example.com/latte-art.jpg"],
                        "note": "Great pour-over selection",
                        "stars": 4,
                        "review_text": "Excellent single-origin options with a cozy atmosphere",
                        "confirmed_tags": ["wifi", "quiet", "good-coffee"],
                    },
                )
                assert response.status_code == 200
                mock_svc.create.assert_called_once_with(
                    user_id="user-abc123",
                    shop_id="shop-taipei-01",
                    photo_urls=["https://storage.example.com/latte-art.jpg"],
                    menu_photo_url=None,
                    note="Great pour-over selection",
                    stars=4,
                    review_text="Excellent single-origin options with a cozy atmosphere",
                    confirmed_tags=["wifi", "quiet", "good-coffee"],
                )
        finally:
            app.dependency_overrides.clear()

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
        try:
            with patch("api.checkins.CheckInService") as mock_cls:
                mock_svc = AsyncMock()
                mock_svc.update_review.return_value = MagicMock(
                    model_dump=lambda: {
                        "id": "ci-456",
                        "stars": 5,
                        "review_text": "Best espresso in Taipei",
                        "confirmed_tags": ["good-coffee", "cozy"],
                    }
                )
                mock_cls.return_value = mock_svc
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
                mock_svc.update_review.assert_called_once_with(
                    checkin_id="ci-456",
                    stars=5,
                    review_text="Best espresso in Taipei",
                    confirmed_tags=["good-coffee", "cozy"],
                )
        finally:
            app.dependency_overrides.clear()

    def test_update_review_not_found_returns_403(self):
        """When a user tries to update a review on a non-owned check-in, they get 403."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-abc123"}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        try:
            with patch("api.checkins.CheckInService") as mock_cls:
                mock_svc = AsyncMock()
                mock_svc.update_review.side_effect = ValueError("Check-in not found")
                mock_cls.return_value = mock_svc
                response = client.patch(
                    "/checkins/ci-not-mine/review",
                    json={"stars": 3},
                )
                assert response.status_code == 403
        finally:
            app.dependency_overrides.clear()
