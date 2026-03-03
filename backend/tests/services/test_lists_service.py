from datetime import datetime
from unittest.mock import MagicMock

import pytest
from postgrest.exceptions import APIError

from services.lists_service import ListsService

# Realistic UUIDs used as test fixtures — never placeholder strings like "l1"
LIST_ID = "e3b0c442-e49b-441d-b22f-5a00bd8c3e1b"
USER_ID = "f7c2a819-5d2e-4c8b-b6a0-1234567890ab"
SHOP_ID_1 = "a1b2c3d4-5678-90ab-cdef-1234567890ab"
SHOP_ID_2 = "b2c3d4e5-6789-01bc-def0-2345678901bc"


@pytest.fixture
def mock_supabase():
    client = MagicMock()
    return client


@pytest.fixture
def lists_service(mock_supabase):
    return ListsService(db=mock_supabase)


class TestListsService:
    async def test_given_valid_name_when_creating_list_inserts_without_count_query(
        self, lists_service, mock_supabase
    ):
        """create() just inserts — no manual count check before insert."""
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                insert=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(
                            return_value=MagicMock(
                                data=[
                                    {
                                        "id": LIST_ID,
                                        "user_id": USER_ID,
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
        result = await lists_service.create(user_id=USER_ID, name="Favorites")
        assert result.name == "Favorites"
        # Should only call insert — no SELECT count query
        table_calls = [c[0][0] for c in mock_supabase.table.call_args_list]
        assert table_calls == ["lists"]

    async def test_given_user_with_3_lists_when_creating_another_raises_value_error(
        self, lists_service, mock_supabase
    ):
        """DB trigger raises check_violation when user has 3 lists. Service translates to ValueError."""
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
            await lists_service.create(user_id=USER_ID, name="Fourth List")

    async def test_given_owned_list_when_deleting_uses_cascade_not_manual_cleanup(
        self, lists_service, mock_supabase
    ):
        """delete() only touches the lists table — CASCADE handles list_items."""
        mock_delete = MagicMock(
            return_value=MagicMock(
                eq=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(return_value=MagicMock(data=[{"id": LIST_ID}]))
                    )
                )
            )
        )
        mock_supabase.table = MagicMock(return_value=MagicMock(delete=mock_delete))
        await lists_service.delete(list_id=LIST_ID)
        # Should only touch lists — CASCADE handles list_items, no SELECT for ownership
        table_calls = [c[0][0] for c in mock_supabase.table.call_args_list]
        assert table_calls == ["lists"]

    async def test_given_unowned_list_when_deleting_raises_value_error(
        self, lists_service, mock_supabase
    ):
        """RLS blocks the delete (0 rows affected) → service raises ValueError."""
        mock_delete = MagicMock(
            return_value=MagicMock(
                eq=MagicMock(
                    return_value=MagicMock(execute=MagicMock(return_value=MagicMock(data=[])))
                )
            )
        )
        mock_supabase.table = MagicMock(return_value=MagicMock(delete=mock_delete))
        with pytest.raises(ValueError, match="not found or access denied"):
            await lists_service.delete(list_id=LIST_ID)

    async def test_given_shop_and_owned_list_when_adding_shop_returns_list_item(
        self, lists_service, mock_supabase
    ):
        """add_shop() inserts via RLS-enforced ownership — no user_id parameter needed."""
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                insert=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(
                            return_value=MagicMock(
                                data=[
                                    {
                                        "list_id": LIST_ID,
                                        "shop_id": SHOP_ID_1,
                                        "added_at": datetime.now().isoformat(),
                                    }
                                ]
                            )
                        )
                    )
                )
            )
        )
        result = await lists_service.add_shop(list_id=LIST_ID, shop_id=SHOP_ID_1)
        assert result.shop_id == SHOP_ID_1

    async def test_given_shop_already_in_list_when_adding_again_raises_value_error(
        self, lists_service, mock_supabase
    ):
        """Unique constraint violation (23505) from DB is surfaced as ValueError."""
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                insert=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(
                            side_effect=APIError(
                                {"message": "duplicate key value violates unique constraint", "code": "23505", "details": None, "hint": None}
                            )
                        )
                    )
                )
            )
        )
        with pytest.raises(ValueError, match="already in this list"):
            await lists_service.add_shop(list_id=LIST_ID, shop_id=SHOP_ID_1)

    async def test_given_owned_list_item_when_removing_shop_succeeds(
        self, lists_service, mock_supabase
    ):
        """remove_shop() removes via RLS-enforced ownership — no user_id parameter needed."""
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
                                                data=[{"list_id": LIST_ID, "shop_id": SHOP_ID_1}]
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
        await lists_service.remove_shop(list_id=LIST_ID, shop_id=SHOP_ID_1)

    async def test_given_unowned_list_item_when_removing_shop_raises_value_error(
        self, lists_service, mock_supabase
    ):
        """RLS blocks the remove (0 rows affected) → service raises ValueError."""
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
            await lists_service.remove_shop(list_id=LIST_ID, shop_id=SHOP_ID_1)

    async def test_given_user_with_no_lists_when_fetching_returns_empty(
        self, lists_service, mock_supabase
    ):
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
        results = await lists_service.get_by_user(USER_ID)
        assert isinstance(results, list)
        assert results == []

    async def test_given_owned_list_when_renaming_returns_updated_list(
        self, lists_service, mock_supabase
    ):
        """rename() updates the list name for the owning user."""
        mock_update = MagicMock(
            return_value=MagicMock(
                eq=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(
                            return_value=MagicMock(
                                data=[
                                    {
                                        "id": LIST_ID,
                                        "user_id": USER_ID,
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
        result = await lists_service.rename(list_id=LIST_ID, name="New Name")
        assert result.name == "New Name"

    async def test_given_unowned_list_when_renaming_raises_value_error(
        self, lists_service, mock_supabase
    ):
        """RLS blocks the update (0 rows affected) → service raises ValueError."""
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
            await lists_service.rename(list_id=LIST_ID, name="New Name")

    async def test_get_list_shops_returns_full_shop_data(self, lists_service, mock_supabase):
        """get_list_shops() returns full Shop objects for shops in an owned list."""
        now = datetime.now().isoformat()
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                select=MagicMock(
                    return_value=MagicMock(
                        eq=MagicMock(
                            return_value=MagicMock(
                                execute=MagicMock(
                                    return_value=MagicMock(
                                        data=[
                                            {
                                                "id": LIST_ID,
                                                "list_items": [
                                                    {
                                                        "shop_id": SHOP_ID_1,
                                                        "added_at": now,
                                                        "shops": {
                                                            "id": SHOP_ID_1,
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
                                                            "created_at": now,
                                                            "updated_at": now,
                                                        },
                                                    }
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
        results = await lists_service.get_list_shops(list_id=LIST_ID)
        assert len(results) == 1
        assert results[0].name == "山小孩咖啡"
        assert results[0].latitude == 25.0216

    async def test_get_list_shops_raises_when_user_does_not_own_list(
        self, lists_service, mock_supabase
    ):
        """When a user requests a list they don't own, get_list_shops raises ValueError."""
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                select=MagicMock(
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
        with pytest.raises(ValueError, match="not found or access denied"):
            await lists_service.get_list_shops(list_id=LIST_ID)

    async def test_given_user_with_saved_shops_when_fetching_pins_returns_coordinates(
        self, lists_service, mock_supabase
    ):
        """get_pins() returns list_id, shop_id, lat, lng for all saved shops."""
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                select=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(
                            return_value=MagicMock(
                                data=[
                                    {"list_id": LIST_ID, "shop_id": SHOP_ID_1, "shops": {"latitude": 25.0216, "longitude": 121.5312}},
                                    {"list_id": LIST_ID, "shop_id": SHOP_ID_2, "shops": {"latitude": 25.0528, "longitude": 121.5201}},
                                ]
                            )
                        )
                    )
                )
            )
        )
        results = await lists_service.get_pins()
        assert len(results) == 2
        assert results[0].lat == 25.0216

    async def test_given_user_with_saved_shops_when_fetching_lists_includes_items(
        self, lists_service, mock_supabase
    ):
        """get_by_user() must return lists with their items (shop_ids)."""
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
                                                        "id": LIST_ID,
                                                        "user_id": USER_ID,
                                                        "name": "Work spots",
                                                        "created_at": datetime.now().isoformat(),
                                                        "updated_at": datetime.now().isoformat(),
                                                        "list_items": [
                                                            {
                                                                "shop_id": SHOP_ID_1,
                                                                "added_at": datetime.now().isoformat(),
                                                            },
                                                            {
                                                                "shop_id": SHOP_ID_2,
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
        results = await lists_service.get_by_user(USER_ID)
        assert len(results) == 1
        assert len(results[0].items) == 2
        assert results[0].items[0].shop_id == SHOP_ID_1
