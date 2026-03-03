import uuid
from datetime import datetime
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from postgrest.exceptions import APIError

from api.deps import get_current_user, get_user_db
from main import app

client = TestClient(app)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _new_id() -> str:
    return str(uuid.uuid4())


def _now() -> str:
    return datetime.now().isoformat()


# ---------------------------------------------------------------------------
# Auth-wall tests (no DB needed)
# ---------------------------------------------------------------------------


class TestListsAPIAuth:
    def test_create_list_requires_auth(self):
        response = client.post("/lists", json={"name": "Favorites"})
        assert response.status_code == 401

    def test_get_lists_requires_auth(self):
        response = client.get("/lists")
        assert response.status_code == 401

    def test_delete_list_requires_auth(self):
        response = client.delete("/lists/list-1")
        assert response.status_code == 401

    def test_get_pins_requires_auth(self):
        response = client.get("/lists/pins")
        assert response.status_code == 401

    def test_get_list_shops_requires_auth(self):
        response = client.get("/lists/list-1/shops")
        assert response.status_code == 401

    def test_rename_list_requires_auth(self):
        response = client.patch("/lists/list-1", json={"name": "New"})
        assert response.status_code == 401


# ---------------------------------------------------------------------------
# Behavioural tests (real service, mock DB boundary)
# ---------------------------------------------------------------------------


class TestListsAPI:
    def test_rename_list_rejects_empty_name(self):
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": _new_id()}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        response = client.patch("/lists/list-1", json={"name": "   "})
        assert response.status_code == 400

    def test_create_list_rejects_empty_name(self):
        """Creating a list with a whitespace-only name returns 400."""
        mock_db = MagicMock()
        app.dependency_overrides[get_current_user] = lambda: {"id": _new_id()}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        response = client.post("/lists/", json={"name": "   "})
        assert response.status_code == 400

    def test_given_user_with_3_lists_when_creating_another_returns_400(self):
        """API returns 400 when the DB trigger fires a check_violation for the 3-list cap."""
        mock_db = MagicMock()
        mock_db.table.return_value.insert.return_value.execute.side_effect = APIError(
            {
                "message": "Maximum of 3 lists allowed",
                "code": "23514",
                "details": None,
                "hint": None,
            }
        )
        app.dependency_overrides[get_current_user] = lambda: {"id": _new_id()}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        response = client.post("/lists/", json={"name": "Fourth List"})
        assert response.status_code == 400
        detail = response.json()["detail"]
        assert "Maximum" in detail or "3" in detail

    def test_given_valid_name_when_creating_list_returns_created_list(self):
        """Creating a list with a valid name returns the list and uses the injected DB."""
        uid = _new_id()
        lid = _new_id()
        mock_db = MagicMock()
        mock_db.table.return_value.insert.return_value.execute.return_value.data = [
            {
                "id": lid,
                "user_id": uid,
                "name": "Regulars",
                "created_at": _now(),
                "updated_at": _now(),
            }
        ]
        app.dependency_overrides[get_current_user] = lambda: {"id": uid}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        response = client.post("/lists/", json={"name": "Regulars"})
        assert response.status_code == 200
        assert response.json()["name"] == "Regulars"

    def test_given_owned_list_when_deleting_returns_ok(self):
        """Deleting an owned list returns ok."""
        lid = _new_id()
        mock_db = MagicMock()
        mock_db.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = [
            {"id": lid}
        ]
        app.dependency_overrides[get_current_user] = lambda: {"id": _new_id()}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        response = client.delete(f"/lists/{lid}")
        assert response.status_code == 200

    def test_given_unowned_list_when_deleting_returns_403(self):
        """RLS blocking a delete (0 rows affected) returns 403."""
        mock_db = MagicMock()
        mock_db.table.return_value.delete.return_value.eq.return_value.execute.return_value.data = []
        app.dependency_overrides[get_current_user] = lambda: {"id": _new_id()}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        response = client.delete(f"/lists/{_new_id()}")
        assert response.status_code == 403

    def test_given_shop_and_owned_list_when_adding_shop_returns_item(self):
        """Adding a shop to an owned list returns the created list item."""
        lid = _new_id()
        sid = _new_id()
        mock_db = MagicMock()
        mock_db.table.return_value.insert.return_value.execute.return_value.data = [
            {"list_id": lid, "shop_id": sid, "added_at": _now()}
        ]
        app.dependency_overrides[get_current_user] = lambda: {"id": _new_id()}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        response = client.post(f"/lists/{lid}/shops", json={"shop_id": sid})
        assert response.status_code == 200
        assert response.json()["shop_id"] == sid

    def test_given_owned_shop_item_when_removing_returns_ok(self):
        """Removing a shop from an owned list returns ok."""
        lid = _new_id()
        sid = _new_id()
        mock_db = MagicMock()
        mock_db.table.return_value.delete.return_value.eq.return_value.eq.return_value.execute.return_value.data = [
            {"list_id": lid, "shop_id": sid}
        ]
        app.dependency_overrides[get_current_user] = lambda: {"id": _new_id()}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        response = client.delete(f"/lists/{lid}/shops/{sid}")
        assert response.status_code == 200

    def test_given_unowned_list_when_accessing_shops_returns_403(self):
        """Accessing shops from a list the user doesn't own returns 403."""
        lid = _new_id()
        mock_db = MagicMock()
        # list ownership check returns empty → service raises ValueError → 403
        mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value.data = []
        app.dependency_overrides[get_current_user] = lambda: {"id": _new_id()}
        app.dependency_overrides[get_user_db] = lambda: mock_db
        response = client.get(f"/lists/{lid}/shops")
        assert response.status_code == 403
