# backend/tests/test_profile_service.py
from unittest.mock import MagicMock

import pytest

from models.types import ProfileResponse
from services.profile_service import ProfileService


@pytest.fixture
def mock_db():
    db = MagicMock()
    return db


def _make_table_map(profile_data: list, stamp_count: int = 0, checkin_count: int = 0):
    """Build per-table mocks for asyncio.gather dispatch-by-name pattern."""
    profile_table = MagicMock()
    stamp_table = MagicMock()
    checkin_table = MagicMock()

    profile_table.select.return_value.eq.return_value.limit.return_value.execute.return_value.data = profile_data
    stamp_table.select.return_value.eq.return_value.execute.return_value.count = stamp_count
    checkin_table.select.return_value.eq.return_value.execute.return_value.count = checkin_count

    return {"profiles": profile_table, "stamps": stamp_table, "check_ins": checkin_table}


class TestGetProfile:
    @pytest.mark.asyncio
    async def test_profile_page_shows_stamps_and_checkin_counts(self, mock_db: MagicMock):
        table_map = _make_table_map(
            profile_data=[{"display_name": "Mei-Ling", "avatar_url": "https://example.com/avatar.jpg"}],
            stamp_count=12,
            checkin_count=8,
        )
        mock_db.table.side_effect = lambda name: table_map[name]

        service = ProfileService(db=mock_db)
        result = await service.get_profile("user-123")

        assert isinstance(result, ProfileResponse)
        assert result.display_name == "Mei-Ling"
        assert result.stamp_count == 12
        assert result.checkin_count == 8

    @pytest.mark.asyncio
    async def test_new_user_sees_zero_counts_before_first_checkin(self, mock_db: MagicMock):
        table_map = _make_table_map(
            profile_data=[{"display_name": None, "avatar_url": None}],
            stamp_count=0,
            checkin_count=0,
        )
        mock_db.table.side_effect = lambda name: table_map[name]

        service = ProfileService(db=mock_db)
        result = await service.get_profile("user-new")

        assert result.display_name is None
        assert result.stamp_count == 0
        assert result.checkin_count == 0


class TestUpdateProfile:
    @pytest.mark.asyncio
    async def test_user_can_update_their_display_name(self, mock_db: MagicMock):
        service = ProfileService(db=mock_db)
        await service.update_profile("user-123", fields={"display_name"}, display_name="New Name")

        mock_db.table.return_value.update.assert_called_once_with({"display_name": "New Name"})

    @pytest.mark.asyncio
    async def test_patch_with_no_fields_is_a_no_op(self, mock_db: MagicMock):
        service = ProfileService(db=mock_db)
        await service.update_profile("user-123", fields=set())

        mock_db.table.return_value.update.assert_not_called()
