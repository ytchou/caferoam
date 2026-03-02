from unittest.mock import MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.admin_taxonomy import router
from api.deps import get_current_user

test_app = FastAPI()
test_app.include_router(router)
client = TestClient(test_app)

_ADMIN_ID = "a7f3c2e1-4b58-4d9a-8c6e-123456789abc"


def _admin_user():
    return {"id": _ADMIN_ID}


class TestAdminTaxonomyStats:
    def test_non_admin_cannot_access_taxonomy_stats(self):
        """Non-admin user gets 403 when accessing taxonomy stats."""
        test_app.dependency_overrides[get_current_user] = lambda: {"id": "regular-user"}
        try:
            with patch("api.deps.settings") as mock_settings:
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.get("/admin/taxonomy/stats")
            assert response.status_code == 403
        finally:
            test_app.dependency_overrides.clear()

    def test_admin_sees_taxonomy_coverage_stats(self):
        """Admin sees taxonomy coverage stats including tag frequency and low-confidence shops."""
        test_app.dependency_overrides[get_current_user] = _admin_user
        try:
            mock_db = MagicMock()

            # Total shops
            mock_db.table.return_value.select.return_value.execute.return_value = MagicMock(
                count=100
            )

            # shop_tag_counts RPC
            mock_db.rpc.return_value.execute.return_value = MagicMock(
                data=[
                    {"tag_id": "wifi-reliable", "shop_count": 80},
                    {"tag_id": "quiet", "shop_count": 60},
                ]
            )

            # Shops with embeddings
            select_rv = mock_db.table.return_value.select.return_value
            select_rv.not_.is_.return_value.execute.return_value = MagicMock(count=90)

            # Missing embeddings
            is_rv = select_rv.is_.return_value
            is_rv.neq.return_value.limit.return_value.execute.return_value = MagicMock(data=[])

            with (
                patch("api.admin_taxonomy.get_service_role_client", return_value=mock_db),
                patch("api.deps.settings") as mock_settings,
            ):
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.get("/admin/taxonomy/stats")
            assert response.status_code == 200
            data = response.json()
            assert "total_shops" in data
            assert "tag_frequency" in data
        finally:
            test_app.dependency_overrides.clear()
