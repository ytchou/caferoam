from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

from services.checkin_service import CheckInService


@pytest.fixture
def mock_supabase():
    client = MagicMock()
    return client


@pytest.fixture
def checkin_service(mock_supabase):
    return CheckInService(db=mock_supabase)


class TestCheckInService:
    async def test_create_requires_at_least_one_photo(self, checkin_service):
        with pytest.raises(ValueError, match="At least one photo"):
            await checkin_service.create(
                user_id="user-1",
                shop_id="shop-1",
                photo_urls=[],
            )

    async def test_create_only_inserts_checkin_row(self, checkin_service, mock_supabase):
        """After trigger migration: create() should ONLY insert into check_ins.
        Stamp creation and job queueing are handled by the DB trigger."""
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                insert=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(
                            return_value=MagicMock(
                                data=[
                                    {
                                        "id": "ci-1",
                                        "user_id": "user-1",
                                        "shop_id": "shop-1",
                                        "photo_urls": ["https://example.com/photo.jpg"],
                                        "menu_photo_url": None,
                                        "note": None,
                                        "created_at": datetime.now().isoformat(),
                                    }
                                ]
                            )
                        )
                    )
                )
            )
        )
        result = await checkin_service.create(
            user_id="user-1",
            shop_id="shop-1",
            photo_urls=["https://example.com/photo.jpg"],
        )
        assert result.id == "ci-1"
        # Service should only call table("check_ins") — NOT stamps or job_queue
        table_calls = [c[0][0] for c in mock_supabase.table.call_args_list]
        assert table_calls == ["check_ins"]

    async def test_create_with_menu_photo_still_only_inserts_checkin(
        self, checkin_service, mock_supabase
    ):
        """Even with menu_photo_url, service only inserts check_in. Trigger handles job."""
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                insert=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(
                            return_value=MagicMock(
                                data=[
                                    {
                                        "id": "ci-1",
                                        "user_id": "user-1",
                                        "shop_id": "shop-1",
                                        "photo_urls": ["https://example.com/photo.jpg"],
                                        "menu_photo_url": "https://example.com/menu.jpg",
                                        "note": None,
                                        "created_at": datetime.now().isoformat(),
                                    }
                                ]
                            )
                        )
                    )
                )
            )
        )
        await checkin_service.create(
            user_id="user-1",
            shop_id="shop-1",
            photo_urls=["https://example.com/photo.jpg"],
            menu_photo_url="https://example.com/menu.jpg",
        )
        table_calls = [c[0][0] for c in mock_supabase.table.call_args_list]
        assert table_calls == ["check_ins"]

    async def test_get_by_user(self, checkin_service, mock_supabase):
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
        results = await checkin_service.get_by_user("user-1")
        assert isinstance(results, list)

    async def test_get_by_shop(self, checkin_service, mock_supabase):
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
        results = await checkin_service.get_by_shop("shop-1")
        assert isinstance(results, list)

    async def test_create_with_review_includes_review_fields(self, checkin_service, mock_supabase):
        """When a user checks in with a star rating, review fields are persisted."""
        frozen_now = datetime(2026, 3, 4, 12, 0, 0, tzinfo=timezone.utc)
        mock_supabase.table = MagicMock(
            return_value=MagicMock(
                insert=MagicMock(
                    return_value=MagicMock(
                        execute=MagicMock(
                            return_value=MagicMock(
                                data=[
                                    {
                                        "id": "ci-review-1",
                                        "user_id": "user-42",
                                        "shop_id": "shop-fuji",
                                        "photo_urls": ["https://cdn.caferoam.tw/photo1.jpg"],
                                        "menu_photo_url": None,
                                        "note": "Great latte art",
                                        "stars": 4,
                                        "review_text": "Cozy spot with excellent pour-over",
                                        "confirmed_tags": ["quiet", "wifi"],
                                        "reviewed_at": frozen_now.isoformat(),
                                        "created_at": frozen_now.isoformat(),
                                    }
                                ]
                            )
                        )
                    )
                )
            )
        )
        with patch("services.checkin_service.datetime") as mock_dt:
            mock_dt.now.return_value = frozen_now
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            result = await checkin_service.create(
                user_id="user-42",
                shop_id="shop-fuji",
                photo_urls=["https://cdn.caferoam.tw/photo1.jpg"],
                note="Great latte art",
                stars=4,
                review_text="Cozy spot with excellent pour-over",
                confirmed_tags=["quiet", "wifi"],
            )
        assert result.stars == 4
        assert result.review_text == "Cozy spot with excellent pour-over"
        assert result.confirmed_tags == ["quiet", "wifi"]
        insert_call = mock_supabase.table.return_value.insert.call_args[0][0]
        assert insert_call["stars"] == 4
        assert insert_call["review_text"] == "Cozy spot with excellent pour-over"
        assert insert_call["confirmed_tags"] == ["quiet", "wifi"]
        assert insert_call["reviewed_at"] == frozen_now.isoformat()

    async def test_update_review_sets_review_fields(self, checkin_service, mock_supabase):
        """When a user adds a review to an existing check-in, review fields are updated."""
        frozen_now = datetime(2026, 3, 4, 14, 30, 0, tzinfo=timezone.utc)
        mock_supabase.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[
                {
                    "id": "ci-existing",
                    "user_id": "user-42",
                    "shop_id": "shop-fuji",
                    "photo_urls": ["https://cdn.caferoam.tw/photo1.jpg"],
                    "menu_photo_url": None,
                    "note": None,
                    "stars": 5,
                    "review_text": "Changed my mind, it is amazing",
                    "confirmed_tags": ["quiet"],
                    "reviewed_at": frozen_now.isoformat(),
                    "created_at": "2026-03-04T10:00:00+00:00",
                }
            ]
        )

        with patch("services.checkin_service.datetime") as mock_dt:
            mock_dt.now.return_value = frozen_now
            mock_dt.side_effect = lambda *a, **kw: datetime(*a, **kw)
            result = await checkin_service.update_review(
                checkin_id="ci-existing",
                user_id="user-42",
                stars=5,
                review_text="Changed my mind, it is amazing",
                confirmed_tags=["quiet"],
            )
        assert result.stars == 5
        assert result.review_text == "Changed my mind, it is amazing"
        update_call = mock_supabase.table.return_value.update.call_args[0][0]
        assert update_call["stars"] == 5
        assert update_call["reviewed_at"] == frozen_now.isoformat()

    async def test_update_review_not_found_raises(self, checkin_service, mock_supabase):
        """When update_review targets a check-in the user doesn't own, a ValueError is raised."""
        mock_supabase.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value = MagicMock(
            data=[]
        )

        with pytest.raises(ValueError, match="Check-in not found"):
            await checkin_service.update_review(
                checkin_id="ci-nonexistent",
                user_id="user-42",
                stars=3,
            )

    async def test_create_with_review_text_but_no_stars_raises(self, checkin_service):
        """When a user provides review text without a star rating, validation fails."""
        with pytest.raises(ValueError, match="review_text requires a star rating"):
            await checkin_service.create(
                user_id="user-42",
                shop_id="shop-fuji",
                photo_urls=["https://cdn.caferoam.tw/photo1.jpg"],
                review_text="Nice place",
            )

    async def test_create_with_invalid_stars_raises(self, checkin_service):
        """When a user provides a star rating outside 1-5, validation fails."""
        with pytest.raises(ValueError, match="Stars must be between 1 and 5"):
            await checkin_service.create(
                user_id="user-42",
                shop_id="shop-fuji",
                photo_urls=["https://cdn.caferoam.tw/photo1.jpg"],
                stars=0,
            )
        with pytest.raises(ValueError, match="Stars must be between 1 and 5"):
            await checkin_service.create(
                user_id="user-42",
                shop_id="shop-fuji",
                photo_urls=["https://cdn.caferoam.tw/photo1.jpg"],
                stars=6,
            )
