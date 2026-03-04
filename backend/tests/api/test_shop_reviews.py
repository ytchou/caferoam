from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from api.deps import get_admin_db, get_current_user
from main import app

client = TestClient(app)


class TestShopReviewsAPI:
    def test_unauthenticated_user_cannot_view_reviews(self):
        """When a visitor requests shop reviews without logging in, they get 401."""
        response = client.get("/shops/shop-abc123/reviews")
        assert response.status_code == 401

    def test_authenticated_user_sees_aggregated_review_data(self):
        """Logged-in user gets reviews list, total count, and average rating for a shop."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-chen-wei"}
        app.dependency_overrides[get_admin_db] = lambda: mock_db
        try:
            review_rows = [
                {
                    "id": "ci-review-1",
                    "user_id": "user-chen-wei",
                    "stars": 4,
                    "review_text": "Excellent pour-over, cozy atmosphere",
                    "confirmed_tags": ["has-wifi", "quiet"],
                    "reviewed_at": "2026-03-01T14:30:00Z",
                    "profiles": {"display_name": "Chen Wei"},
                },
                {
                    "id": "ci-review-2",
                    "user_id": "user-mei-lin",
                    "stars": 5,
                    "review_text": "Best single-origin in Taipei",
                    "confirmed_tags": ["specialty-coffee"],
                    "reviewed_at": "2026-03-02T09:15:00Z",
                    "profiles": {"display_name": "Mei Lin"},
                },
            ]

            # Paginated query: table().select().eq().not_().order().limit().offset().execute()
            paginated_chain = mock_db.table.return_value.select.return_value.eq.return_value.not_.return_value.order.return_value.limit.return_value.offset.return_value
            paginated_chain.execute.return_value = MagicMock(data=review_rows, count=2)

            # RPC for average rating
            mock_db.rpc.return_value.execute.return_value = MagicMock(data=4.5)

            response = client.get("/shops/shop-abc123/reviews")
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] == 2
        assert data["average_rating"] == 4.5
        assert len(data["reviews"]) == 2
        assert data["reviews"][0]["display_name"] == "Chen Wei"
        assert data["reviews"][0]["stars"] == 4
        assert data["reviews"][1]["display_name"] == "Mei Lin"

    def test_shop_with_no_reviews_returns_empty_and_zero_average(self):
        """When a shop has no reviews, the response has an empty list and 0.0 average."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": "user-chen-wei"}
        app.dependency_overrides[get_admin_db] = lambda: mock_db
        try:
            paginated_chain = mock_db.table.return_value.select.return_value.eq.return_value.not_.return_value.order.return_value.limit.return_value.offset.return_value
            paginated_chain.execute.return_value = MagicMock(data=[], count=0)
            mock_db.rpc.return_value.execute.return_value = MagicMock(data=0.0)

            response = client.get("/shops/shop-empty/reviews")
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 200
        data = response.json()
        assert data["total_count"] == 0
        assert data["average_rating"] == 0.0
        assert data["reviews"] == []
