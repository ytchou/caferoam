from collections.abc import Callable
from datetime import UTC, datetime
from unittest.mock import MagicMock, patch

import pytest

from core.exceptions import NotFoundError
from services.checkin_service import CheckInService


def _make_table_router(
    taxonomy_table: MagicMock,
    count_table: MagicMock,
    insert_table: MagicMock,
) -> Callable[[str], MagicMock]:
    """Returns a side_effect function that routes table() calls by name.

    taxonomy_tags → taxonomy_table
    check_ins (1st call) → count_table
    check_ins (2nd call) → insert_table
    """
    call_count = 0

    def router(name: str) -> MagicMock:
        nonlocal call_count
        if name == "taxonomy_tags":
            return taxonomy_table
        call_count += 1
        return count_table if call_count == 1 else insert_table

    return router


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
                user_id="user-mei-ling-001",
                shop_id="shop-fuji-zhongshan",
                photo_urls=[],
            )

    async def test_create_only_inserts_checkin_row(self, checkin_service, mock_supabase):
        """After trigger migration: create() should ONLY insert into check_ins.
        Stamp creation and job queueing are handled by the DB trigger."""
        count_table = MagicMock()
        count_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            MagicMock(count=0)
        )

        insert_table = MagicMock()
        insert_table.insert.return_value.execute.return_value = MagicMock(
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

        mock_supabase.table.side_effect = [count_table, insert_table]

        result = await checkin_service.create(
            user_id="user-1",
            shop_id="shop-1",
            photo_urls=["https://example.com/photo.jpg"],
        )
        assert result.id == "ci-1"
        assert result.is_first_checkin_at_shop is True
        # Service should only call table("check_ins") — NOT stamps or job_queue
        # (Two calls expected: one count query + one insert)
        table_calls = [c[0][0] for c in mock_supabase.table.call_args_list]
        assert set(table_calls) == {"check_ins"}

    async def test_create_with_menu_photo_still_only_inserts_checkin(
        self, checkin_service, mock_supabase
    ):
        """Even with menu_photo_url, service only inserts check_in. Trigger handles job."""
        count_table = MagicMock()
        count_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            MagicMock(count=0)
        )

        insert_table = MagicMock()
        insert_table.insert.return_value.execute.return_value = MagicMock(
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

        mock_supabase.table.side_effect = [count_table, insert_table]

        result = await checkin_service.create(
            user_id="user-1",
            shop_id="shop-1",
            photo_urls=["https://example.com/photo.jpg"],
            menu_photo_url="https://example.com/menu.jpg",
        )
        assert result.is_first_checkin_at_shop is True
        # Service should only call table("check_ins") — NOT stamps or job_queue
        # (Two calls expected: one count query + one insert)
        table_calls = [c[0][0] for c in mock_supabase.table.call_args_list]
        assert set(table_calls) == {"check_ins"}

    async def test_user_checkin_history_includes_shop_name_and_mrt(
        self, checkin_service, mock_supabase
    ):
        """When a user fetches their check-ins, each record includes shop name and MRT line."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(
            data=[
                {
                    "id": "ci-yongkang-001",
                    "user_id": "user-mei-ling-001",
                    "shop_id": "shop-fuji-zhongshan",
                    "photo_urls": ["https://cdn.caferoam.tw/checkins/latte-art.jpg"],
                    "menu_photo_url": None,
                    "note": "Cozy corner spot",
                    "stars": 4,
                    "review_text": None,
                    "confirmed_tags": [],
                    "reviewed_at": None,
                    "created_at": "2026-03-01T10:00:00+00:00",
                    "shops": {"name": "Fuji Coffee", "mrt": "Zhongshan"},
                }
            ]
        )
        results = await checkin_service.get_by_user("user-mei-ling-001")
        assert len(results) == 1
        assert results[0].shop_name == "Fuji Coffee"
        assert results[0].shop_mrt == "Zhongshan"
        assert results[0].photo_urls == ["https://cdn.caferoam.tw/checkins/latte-art.jpg"]

    async def test_shop_checkin_list_is_returned_for_shop_page(
        self, checkin_service, mock_supabase
    ):
        """When the shop detail page requests check-ins for a shop, all records are returned."""
        mock_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(
            data=[
                {
                    "id": "ci-yongkang-001",
                    "user_id": "user-mei-ling-001",
                    "shop_id": "shop-fuji-zhongshan",
                    "photo_urls": ["https://cdn.caferoam.tw/checkins/flat-white.jpg"],
                    "menu_photo_url": None,
                    "note": None,
                    "stars": None,
                    "review_text": None,
                    "confirmed_tags": None,
                    "reviewed_at": None,
                    "created_at": "2026-03-01T10:00:00+00:00",
                }
            ]
        )
        results = await checkin_service.get_by_shop("shop-fuji-zhongshan")
        assert len(results) == 1
        assert results[0].shop_id == "shop-fuji-zhongshan"

    async def test_create_with_review_includes_review_fields(self, checkin_service, mock_supabase):
        """When a user checks in with a star rating, review fields are persisted."""
        frozen_now = datetime(2026, 3, 4, 12, 0, 0, tzinfo=UTC)

        taxonomy_table = MagicMock()
        taxonomy_table.select.return_value.in_.return_value.execute.return_value = MagicMock(
            data=[{"id": "quiet"}, {"id": "wifi"}]
        )

        count_table = MagicMock()
        count_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            MagicMock(count=0)
        )

        insert_table = MagicMock()
        insert_table.insert.return_value.execute.return_value = MagicMock(
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

        mock_supabase.table.side_effect = _make_table_router(
            taxonomy_table, count_table, insert_table
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
        insert_call = insert_table.insert.call_args[0][0]
        assert insert_call["stars"] == 4
        assert insert_call["review_text"] == "Cozy spot with excellent pour-over"
        assert insert_call["confirmed_tags"] == ["quiet", "wifi"]
        assert insert_call["reviewed_at"] == frozen_now.isoformat()

    async def test_update_review_sets_review_fields(self, checkin_service, mock_supabase):
        """When a user adds a review to an existing check-in, review fields are updated."""
        frozen_now = datetime(2026, 3, 4, 14, 30, 0, tzinfo=UTC)
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

        with pytest.raises(NotFoundError, match="Check-in not found"):
            await checkin_service.update_review(
                checkin_id="ci-nonexistent",
                user_id="user-42",
                stars=3,
            )

    async def test_create_with_confirmed_tags_but_no_stars_raises(self, checkin_service):
        """When a user provides confirmed tags without a star rating, validation fails."""
        with pytest.raises(ValueError, match="confirmed_tags requires a star rating"):
            await checkin_service.create(
                user_id="user-mei-ling-001",
                shop_id="shop-fuji-zhongshan",
                photo_urls=["https://cdn.caferoam.tw/photo1.jpg"],
                confirmed_tags=["quiet", "wifi"],
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


class TestConfirmedTagsValidation:
    """Confirmed tags must exist in taxonomy_tags table."""

    async def test_create_rejects_unknown_tags(self, mock_supabase, checkin_service):
        """When a user submits tag IDs not in taxonomy, return ValueError."""
        taxonomy_table = MagicMock()
        taxonomy_table.select.return_value.in_.return_value.execute.return_value = MagicMock(
            data=[{"id": "quiet"}, {"id": "wifi"}]
        )

        count_table = MagicMock()
        count_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            MagicMock(count=0)
        )

        mock_supabase.table.side_effect = lambda name: {
            "taxonomy_tags": taxonomy_table,
            "check_ins": count_table,
        }[name]

        with pytest.raises(ValueError, match="Unknown tag IDs"):
            await checkin_service.create(
                user_id="user-1",
                shop_id="shop-1",
                photo_urls=["https://example.com/photo.jpg"],
                stars=4,
                confirmed_tags=["quiet", "wifi", "fake_tag"],
            )

    async def test_create_accepts_valid_tags(self, mock_supabase, checkin_service):
        """When all tag IDs exist in taxonomy, check-in succeeds."""
        taxonomy_table = MagicMock()
        taxonomy_table.select.return_value.in_.return_value.execute.return_value = MagicMock(
            data=[{"id": "quiet"}, {"id": "wifi"}]
        )

        count_table = MagicMock()
        count_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            MagicMock(count=0)
        )

        insert_table = MagicMock()
        insert_table.insert.return_value.execute.return_value = MagicMock(
            data=[
                {
                    "id": "ci-new",
                    "user_id": "user-1",
                    "shop_id": "shop-1",
                    "photo_urls": ["https://example.com/photo.jpg"],
                    "menu_photo_url": None,
                    "note": None,
                    "stars": 4,
                    "review_text": None,
                    "confirmed_tags": ["quiet", "wifi"],
                    "reviewed_at": "2026-03-05T00:00:00Z",
                    "created_at": "2026-03-05T00:00:00Z",
                }
            ]
        )

        mock_supabase.table.side_effect = _make_table_router(
            taxonomy_table, count_table, insert_table
        )

        result = await checkin_service.create(
            user_id="user-1",
            shop_id="shop-1",
            photo_urls=["https://example.com/photo.jpg"],
            stars=4,
            confirmed_tags=["quiet", "wifi"],
        )
        assert result.id == "ci-new"

    async def test_create_skips_validation_when_no_tags(self, mock_supabase, checkin_service):
        """When confirmed_tags is None, skip taxonomy validation entirely."""
        count_table = MagicMock()
        count_table.select.return_value.eq.return_value.eq.return_value.execute.return_value = (
            MagicMock(count=0)
        )

        insert_table = MagicMock()
        insert_table.insert.return_value.execute.return_value = MagicMock(
            data=[
                {
                    "id": "ci-no-tags",
                    "user_id": "user-1",
                    "shop_id": "shop-1",
                    "photo_urls": ["https://example.com/photo.jpg"],
                    "menu_photo_url": None,
                    "note": None,
                    "stars": None,
                    "review_text": None,
                    "confirmed_tags": None,
                    "reviewed_at": None,
                    "created_at": "2026-03-05T00:00:00Z",
                }
            ]
        )

        mock_supabase.table.side_effect = [count_table, insert_table]

        result = await checkin_service.create(
            user_id="user-1",
            shop_id="shop-1",
            photo_urls=["https://example.com/photo.jpg"],
            confirmed_tags=None,
        )
        assert result.id == "ci-no-tags"
        table_calls = [c[0][0] for c in mock_supabase.table.call_args_list]
        assert "taxonomy_tags" not in table_calls
