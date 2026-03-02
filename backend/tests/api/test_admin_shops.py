from unittest.mock import AsyncMock, MagicMock, patch

from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.admin_shops import router
from api.deps import get_current_user
from providers.embeddings import get_embeddings_provider
from tests.factories import make_shop_row

# Create a test app with just this router
test_app = FastAPI()
test_app.include_router(router)
client = TestClient(test_app)

_ADMIN_ID = "a7f3c2e1-4b58-4d9a-8c6e-123456789abc"


def _admin_user():
    return {"id": _ADMIN_ID}


class TestAdminShopsList:
    def test_non_admin_cannot_list_shops(self):
        """Non-admin user gets 403 when listing shops."""
        test_app.dependency_overrides[get_current_user] = lambda: {"id": "regular-user"}
        try:
            with patch("api.deps.settings") as mock_settings:
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.get("/admin/shops")
            assert response.status_code == 403
        finally:
            test_app.dependency_overrides.clear()

    def test_admin_can_list_all_shops(self):
        """Admin user can list all shops with pagination."""
        test_app.dependency_overrides[get_current_user] = _admin_user
        try:
            mock_db = MagicMock()
            shops = [
                make_shop_row(id="shop-1", name="田田咖啡"),
                make_shop_row(id="shop-2", name="蟻窩咖啡"),
            ]
            select_rv = mock_db.table.return_value.select.return_value
            select_rv.order.return_value.range.return_value.execute.return_value = MagicMock(
                data=shops, count=2
            )
            with (
                patch("api.admin_shops.get_service_role_client", return_value=mock_db),
                patch("api.deps.settings") as mock_settings,
            ):
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.get("/admin/shops")
            assert response.status_code == 200
            data = response.json()
            assert len(data["shops"]) == 2
        finally:
            test_app.dependency_overrides.clear()

    def test_admin_can_filter_shops_by_processing_status(self):
        """Admin can filter shops by processing_status."""
        test_app.dependency_overrides[get_current_user] = _admin_user
        try:
            mock_db = MagicMock()
            select_rv = mock_db.table.return_value.select.return_value
            eq_rv = select_rv.eq.return_value
            eq_rv.order.return_value.range.return_value.execute.return_value = MagicMock(
                data=[], count=0
            )
            with (
                patch("api.admin_shops.get_service_role_client", return_value=mock_db),
                patch("api.deps.settings") as mock_settings,
            ):
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.get("/admin/shops?processing_status=failed")
            assert response.status_code == 200
        finally:
            test_app.dependency_overrides.clear()


class TestAdminShopCreate:
    def test_admin_creates_shop_with_manual_source_and_audit_log(self):
        """Admin creates a manually-entered shop with audit logging."""
        test_app.dependency_overrides[get_current_user] = _admin_user
        try:
            mock_db = MagicMock()
            mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(
                data=[{"id": "new-shop-1", "name": "手沖咖啡店"}]
            )
            with (
                patch("api.admin_shops.get_service_role_client", return_value=mock_db),
                patch("middleware.admin_audit.get_service_role_client", return_value=mock_db),
                patch("api.deps.settings") as mock_settings,
            ):
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.post(
                    "/admin/shops",
                    json={
                        "name": "手沖咖啡店",
                        "address": "台北市中山區",
                        "latitude": 25.05,
                        "longitude": 121.52,
                    },
                )
            assert response.status_code == 201
        finally:
            test_app.dependency_overrides.clear()


class TestAdminShopDetail:
    def test_admin_can_view_shop_with_tags_and_photos(self):
        """Admin can view full shop detail including tags and photos."""
        test_app.dependency_overrides[get_current_user] = _admin_user
        try:
            mock_db = MagicMock()
            select_rv = mock_db.table.return_value.select.return_value
            select_rv.eq.return_value.single.return_value.execute.return_value = MagicMock(
                data={"id": "shop-1", "name": "山小孩咖啡", "processing_status": "live"}
            )
            select_rv.eq.return_value.execute.return_value = MagicMock(data=[])
            select_rv.eq.return_value.order.return_value.execute.return_value = MagicMock(data=[])
            with (
                patch("api.admin_shops.get_service_role_client", return_value=mock_db),
                patch("api.deps.settings") as mock_settings,
            ):
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.get("/admin/shops/shop-1")
            assert response.status_code == 200
            data = response.json()
            assert data["shop"]["id"] == "shop-1"
        finally:
            test_app.dependency_overrides.clear()


class TestAdminShopUpdate:
    def test_admin_update_sets_manually_edited_at_timestamp(self):
        """When admin updates a shop, manually_edited_at is set."""
        test_app.dependency_overrides[get_current_user] = _admin_user
        try:
            mock_db = MagicMock()
            mock_db.table.return_value.update.return_value.eq.return_value.execute.return_value = (
                MagicMock(data=[{"id": "shop-1", "name": "Updated"}])
            )
            with (
                patch("api.admin_shops.get_service_role_client", return_value=mock_db),
                patch("middleware.admin_audit.get_service_role_client", return_value=mock_db),
                patch("api.deps.settings") as mock_settings,
            ):
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.put(
                    "/admin/shops/shop-1",
                    json={"name": "Updated Name"},
                )
            assert response.status_code == 200
            update_call = mock_db.table.return_value.update
            update_data = update_call.call_args[0][0]
            assert "manually_edited_at" in update_data
        finally:
            test_app.dependency_overrides.clear()


class TestAdminShopEnqueue:
    def test_admin_can_trigger_enrich_pipeline_job(self):
        """Admin can manually trigger a pipeline job for a shop."""
        test_app.dependency_overrides[get_current_user] = _admin_user
        try:
            mock_db = MagicMock()
            select_rv = mock_db.table.return_value.select.return_value
            eq3_rv = select_rv.eq.return_value.eq.return_value.eq.return_value
            eq3_rv.execute.return_value = MagicMock(data=[])
            # JobQueue.enqueue inserts a row and returns its id
            mock_db.table.return_value.insert.return_value.execute.return_value = MagicMock(
                data=[{"id": "job-1"}]
            )
            with (
                patch("api.admin_shops.get_service_role_client", return_value=mock_db),
                patch("middleware.admin_audit.get_service_role_client", return_value=mock_db),
                patch("api.deps.settings") as mock_settings,
            ):
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.post(
                    "/admin/shops/shop-1/enqueue",
                    json={"job_type": "enrich_shop"},
                )
            assert response.status_code == 200
            assert response.json()["job_id"] == "job-1"
        finally:
            test_app.dependency_overrides.clear()

    def test_duplicate_pending_job_returns_409(self):
        """If a pending job of the same type already exists, return 409."""
        test_app.dependency_overrides[get_current_user] = _admin_user
        try:
            mock_db = MagicMock()
            select_rv = mock_db.table.return_value.select.return_value
            eq3_rv = select_rv.eq.return_value.eq.return_value.eq.return_value
            eq3_rv.execute.return_value = MagicMock(data=[{"id": "existing-job"}])
            with (
                patch("api.admin_shops.get_service_role_client", return_value=mock_db),
                patch("api.deps.settings") as mock_settings,
            ):
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.post(
                    "/admin/shops/shop-1/enqueue",
                    json={"job_type": "enrich_shop"},
                )
            assert response.status_code == 409
        finally:
            test_app.dependency_overrides.clear()


class TestAdminShopSearchRank:
    def test_admin_can_check_shop_search_rank_for_a_query(self):
        """Admin can check where a shop ranks for a given search query."""
        mock_provider = MagicMock()
        mock_provider.embed = AsyncMock(return_value=[0.1] * 1536)
        test_app.dependency_overrides[get_current_user] = _admin_user
        test_app.dependency_overrides[get_embeddings_provider] = lambda: mock_provider
        try:
            mock_db = MagicMock()
            search_results = [
                {"id": "other-1", "similarity": 0.9},
                {"id": "other-2", "similarity": 0.85},
                {"id": "shop-1", "similarity": 0.8},
            ]
            mock_db.rpc.return_value.execute.return_value = MagicMock(data=search_results)
            with (
                patch("api.admin_shops.get_service_role_client", return_value=mock_db),
                patch("api.deps.settings") as mock_settings,
            ):
                mock_settings.admin_user_ids = [_ADMIN_ID]
                response = client.get("/admin/shops/shop-1/search-rank?query=quiet+coffee")
            assert response.status_code == 200
            data = response.json()
            assert data["rank"] == 3
            assert data["total_results"] == 3
        finally:
            test_app.dependency_overrides.clear()
