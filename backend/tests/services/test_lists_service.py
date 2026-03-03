from datetime import datetime
from unittest.mock import MagicMock

import pytest
from postgrest.exceptions import APIError

from services.lists_service import ListsService


@pytest.fixture
def mock_supabase():
    client = MagicMock()
    return client


@pytest.fixture
def lists_service(mock_supabase):
    return ListsService(db=mock_supabase)


class TestListsService:
    async def test_create_list_succeeds(self, lists_service, mock_supabase):
        """create() just inserts — no manual count check."""
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                insert=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(
                            return_value=MagicMock(
                                data=[
                                    {
                                        "id": "l1",
                                        "user_id": "user-1",
                                        "name": "Favorites",
                                        "created_at": datetime.now().isoformat(),
                                        "updated_at": datetime.now().isoformat(),
                                    }
                                ]
                            )
                        )
                    )
                )
            )
        )
        result = await lists_service.create(user_id="user-1", name="Favorites")
        assert result.name == "Favorites"
        # Should only call insert — no SELECT count query
        table_calls = [c[0][0] for c in mock_supabase.table.call_args_list]
        assert table_calls == ["lists"]

    async def test_create_list_catches_trigger_violation(self, lists_service, mock_supabase):
        """DB trigger raises check_violation when >= 3 lists. Service catches and re-raises."""
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                insert=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(
                            side_effect=APIError(
                                {
                                    "message": "Maximum of 3 lists allowed",
                                    "code": "23514",
                                    "details": None,
                                    "hint": None,
                                }
                            )
                        )
                    )
                )
            )
        )
        with pytest.raises(ValueError, match="Maximum of 3 lists"):
            await lists_service.create(user_id="user-1", name="Fourth")

    async def test_delete_list_succeeds(self, lists_service, mock_supabase):
        """delete() only touches lists table (CASCADE handles list_items), no ownership SELECT."""
        mock_delete = MagicMock(
            return_value=MagicMock(
                eq=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(return_value=MagicMock(data=[{"id": "l1"}]))
                    )
                )
            )
        )
        mock_supabase.table = MagicMock(return_value=MagicMock(delete=mock_delete))
        await lists_service.delete(list_id="l1")
        # Should only touch lists — CASCADE handles list_items, no SELECT for ownership
        table_calls = [c[0][0] for c in mock_supabase.table.call_args_list]
        assert table_calls == ["lists"]

    async def test_delete_list_raises_if_not_found_or_unauthorized(
        self, lists_service, mock_supabase
    ):
        """delete() raises ValueError when RLS blocks the delete (0 rows affected)."""
        mock_delete = MagicMock(
            return_value=MagicMock(
                eq=MagicMock(
                    return_value=MagicMock(execute=MagicMock(return_value=MagicMock(data=[])))
                )
            )
        )
        mock_supabase.table = MagicMock(return_value=MagicMock(delete=mock_delete))
        with pytest.raises(ValueError, match="not found or access denied"):
            await lists_service.delete(list_id="l1")

    async def test_add_shop_no_user_id_param(self, lists_service, mock_supabase):
        """add_shop() no longer takes user_id — RLS enforces ownership."""
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                insert=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(
                            return_value=MagicMock(
                                data=[
                                    {
                                        "list_id": "l1",
                                        "shop_id": "s1",
                                        "added_at": datetime.now().isoformat(),
                                    }
                                ]
                            )
                        )
                    )
                )
            )
        )
        # Note: no user_id parameter
        result = await lists_service.add_shop(list_id="l1", shop_id="s1")
        assert result.shop_id == "s1"

    async def test_remove_shop_succeeds(self, lists_service, mock_supabase):
        """remove_shop() no longer takes user_id — RLS enforces ownership."""
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                delete=MagicMock(
                    return_value=MagicMock(
                        eq=MagicMock(
                            return_value=MagicMock(
                                eq=MagicMock(
                                    return_value=MagicMock(
                                        execute=MagicMock(
                                            return_value=MagicMock(
                                                data=[{"list_id": "l1", "shop_id": "s1"}]
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
        # Note: no user_id parameter
        await lists_service.remove_shop(list_id="l1", shop_id="s1")

    async def test_remove_shop_raises_if_not_found_or_unauthorized(
        self, lists_service, mock_supabase
    ):
        """remove_shop() raises ValueError when RLS blocks the delete (0 rows affected)."""
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                delete=MagicMock(
                    return_value=MagicMock(
                        eq=MagicMock(
                            return_value=MagicMock(
                                eq=MagicMock(
                                    return_value=MagicMock(
                                        execute=MagicMock(return_value=MagicMock(data=[]))
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
        with pytest.raises(ValueError, match="not found or access denied"):
            await lists_service.remove_shop(list_id="l1", shop_id="s1")

    async def test_get_by_user(self, lists_service, mock_supabase):
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                select=MagicMock(
                    return_value=MagicMock(
                        eq=MagicMock(
                            return_value=MagicMock(
                                order=MagicMock(
                                    return_value=MagicMock(
                                        execute=MagicMock(return_value=MagicMock(data=[]))
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
        results = await lists_service.get_by_user("user-1")
        assert isinstance(results, list)

    async def test_rename_list_succeeds(self, lists_service, mock_supabase):
        """rename() updates the list name via Supabase update."""
        from datetime import datetime
        mock_update = MagicMock(
            return_value=MagicMock(
                eq=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(
                            return_value=MagicMock(
                                data=[
                                    {
                                        "id": "l1",
                                        "user_id": "user-1",
                                        "name": "New Name",
                                        "created_at": datetime.now().isoformat(),
                                        "updated_at": datetime.now().isoformat(),
                                    }
                                ]
                            )
                        )
                    )
                )
            )
        )
        mock_supabase.table = MagicMock(return_value=MagicMock(update=mock_update))
        result = await lists_service.rename(list_id="l1", name="New Name")
        assert result.name == "New Name"

    async def test_rename_list_raises_if_not_found_or_unauthorized(
        self, lists_service, mock_supabase
    ):
        """rename() raises ValueError when RLS blocks the update (0 rows affected)."""
        mock_update = MagicMock(
            return_value=MagicMock(
                eq=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(return_value=MagicMock(data=[]))
                    )
                )
            )
        )
        mock_supabase.table = MagicMock(return_value=MagicMock(update=mock_update))
        with pytest.raises(ValueError, match="not found or access denied"):
            await lists_service.rename(list_id="l1", name="New Name")

    async def test_get_list_shops_returns_full_shop_data(self, lists_service, mock_supabase):
        """get_list_shops() returns full Shop objects for shops in an owned list."""
        from datetime import datetime

        shop_id = "a1b2c3d4-5678-90ab-cdef-1234567890ab"
        list_id = "e3b0c442-e49b-441d-b22f-5a00bd8c3e1b"

        lists_mock = MagicMock()
        lists_mock.select.return_value.eq.return_value.execute.return_value.data = [{"id": list_id}]

        items_mock = MagicMock()
        items_mock.select.return_value.eq.return_value.execute.return_value.data = [
            {
                "shop_id": shop_id,
                "added_at": datetime.now().isoformat(),
                "shops": {
                    "id": shop_id,
                    "name": "山小孩咖啡",
                    "address": "台北市大安區溫州街74巷5弄2號",
                    "latitude": 25.0216,
                    "longitude": 121.5312,
                    "mrt": "台電大樓",
                    "phone": None,
                    "website": None,
                    "opening_hours": None,
                    "rating": 4.6,
                    "review_count": 287,
                    "price_range": "$$",
                    "description": "安靜適合工作",
                    "photo_urls": [],
                    "menu_url": None,
                    "taxonomy_tags": [],
                    "mode_scores": None,
                    "cafenomad_id": None,
                    "google_place_id": None,
                    "created_at": datetime.now().isoformat(),
                    "updated_at": datetime.now().isoformat(),
                },
            }
        ]

        mock_supabase.table.side_effect = lambda name: lists_mock if name == "lists" else items_mock

        results = await lists_service.get_list_shops(list_id=list_id)
        assert len(results) == 1
        assert results[0].name == "山小孩咖啡"
        assert results[0].latitude == 25.0216

    async def test_get_list_shops_raises_when_user_does_not_own_list(
        self, lists_service, mock_supabase
    ):
        """When a user requests a list they don't own, get_list_shops raises ValueError."""
        list_id = "e3b0c442-e49b-441d-b22f-5a00bd8c3e1b"
        lists_mock = MagicMock()
        lists_mock.select.return_value.eq.return_value.execute.return_value.data = []
        mock_supabase.table.side_effect = lambda name: lists_mock

        with pytest.raises(ValueError, match="not found or access denied"):
            await lists_service.get_list_shops(list_id=list_id)

    async def test_get_pins_returns_coordinates(self, lists_service, mock_supabase):
        """get_pins() returns list_id, shop_id, lat, lng for all saved shops."""
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                select=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(
                            return_value=MagicMock(
                                data=[
                                    {"list_id": "l1", "shop_id": "s1", "shops": {"latitude": 25.04, "longitude": 121.52}},
                                    {"list_id": "l1", "shop_id": "s2", "shops": {"latitude": 25.05, "longitude": 121.53}},
                                ]
                            )
                        )
                    )
                )
            )
        )
        results = await lists_service.get_pins("user-1")
        assert len(results) == 2
        assert results[0].lat == 25.04

    async def test_get_by_user_includes_items(self, lists_service, mock_supabase):
        """get_by_user() must return lists with their items (shop_ids)."""
        from datetime import datetime
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                select=MagicMock(
                    return_value=MagicMock(
                        eq=MagicMock(
                            return_value=MagicMock(
                                order=MagicMock(
                                    return_value=MagicMock(
                                        execute=MagicMock(
                                            return_value=MagicMock(
                                                data=[
                                                    {
                                                        "id": "l1",
                                                        "user_id": "user-1",
                                                        "name": "Work spots",
                                                        "created_at": datetime.now().isoformat(),
                                                        "updated_at": datetime.now().isoformat(),
                                                        "list_items": [
                                                            {
                                                                "shop_id": "s1",
                                                                "added_at": datetime.now().isoformat(),
                                                            },
                                                            {
                                                                "shop_id": "s2",
                                                                "added_at": datetime.now().isoformat(),
                                                            },
                                                        ],
                                                    }
                                                ]
                                            )
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
        results = await lists_service.get_by_user("user-1")
        assert len(results) == 1
        assert len(results[0].items) == 2
        assert results[0].items[0].shop_id == "s1"
