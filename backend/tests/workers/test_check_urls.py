"""Tests for the check_urls background URL validation handler."""

import pytest
from unittest.mock import MagicMock, AsyncMock, patch

from workers.handlers.check_urls import check_urls_for_region


@pytest.fixture
def mock_db():
    db = MagicMock()
    return db


class TestCheckUrlsForRegion:
    """Given shops in pending_url_check status, validate their URLs."""

    @pytest.mark.asyncio
    async def test_returns_zero_counts_when_no_pending_shops(self, mock_db):
        """When there are no shops to check, returns all-zero stats."""
        select_chain = MagicMock()
        select_chain.execute.return_value = MagicMock(data=[])
        mock_db.table.return_value.select.return_value.eq.return_value = select_chain

        result = await check_urls_for_region(mock_db)

        assert result == {"checked": 0, "passed": 0, "failed": 0, "errored": 0}

    @pytest.mark.asyncio
    async def test_marks_valid_urls_as_pending_review(self, mock_db):
        """When a shop's URL returns 200, transition to pending_review."""
        shops = [
            {"id": "shop-1", "google_maps_url": "https://maps.google.com/place/123"},
        ]
        select_chain = MagicMock()
        select_chain.execute.return_value = MagicMock(data=shops)
        mock_db.table.return_value.select.return_value.eq.return_value = select_chain

        update_chain = MagicMock()
        update_chain.in_.return_value.execute.return_value = MagicMock()
        mock_db.table.return_value.update.return_value = update_chain

        mock_response = AsyncMock()
        mock_response.status_code = 200

        with patch("workers.handlers.check_urls.httpx.AsyncClient") as MockClient:
            client_instance = AsyncMock()
            client_instance.head = AsyncMock(return_value=mock_response)
            MockClient.return_value.__aenter__ = AsyncMock(return_value=client_instance)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await check_urls_for_region(mock_db)

        assert result["passed"] == 1
        assert result["failed"] == 0
        mock_db.table.return_value.update.assert_any_call({"processing_status": "pending_review"})

    @pytest.mark.asyncio
    async def test_marks_dead_urls_as_filtered(self, mock_db):
        """When a shop's URL returns 404, transition to filtered_dead_url."""
        shops = [
            {"id": "shop-dead", "google_maps_url": "https://maps.google.com/place/gone"},
        ]
        select_chain = MagicMock()
        select_chain.execute.return_value = MagicMock(data=shops)
        mock_db.table.return_value.select.return_value.eq.return_value = select_chain

        update_chain = MagicMock()
        update_chain.in_.return_value.execute.return_value = MagicMock()
        mock_db.table.return_value.update.return_value = update_chain

        mock_response = AsyncMock()
        mock_response.status_code = 404

        with patch("workers.handlers.check_urls.httpx.AsyncClient") as MockClient:
            client_instance = AsyncMock()
            client_instance.head = AsyncMock(return_value=mock_response)
            MockClient.return_value.__aenter__ = AsyncMock(return_value=client_instance)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await check_urls_for_region(mock_db)

        assert result["failed"] == 1
        assert result["passed"] == 0
        mock_db.table.return_value.update.assert_any_call(
            {"processing_status": "filtered_dead_url"}
        )

    @pytest.mark.asyncio
    async def test_handles_timeout_as_dead_url(self, mock_db):
        """When a URL times out, treat it as a dead URL."""
        shops = [
            {"id": "shop-timeout", "google_maps_url": "https://maps.google.com/place/slow"},
        ]
        select_chain = MagicMock()
        select_chain.execute.return_value = MagicMock(data=shops)
        mock_db.table.return_value.select.return_value.eq.return_value = select_chain

        update_chain = MagicMock()
        update_chain.in_.return_value.execute.return_value = MagicMock()
        mock_db.table.return_value.update.return_value = update_chain

        import httpx

        with patch("workers.handlers.check_urls.httpx.AsyncClient") as MockClient:
            client_instance = AsyncMock()
            client_instance.head = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
            MockClient.return_value.__aenter__ = AsyncMock(return_value=client_instance)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await check_urls_for_region(mock_db)

        assert result["failed"] == 1

    @pytest.mark.asyncio
    async def test_processes_multiple_shops_in_batch(self, mock_db):
        """Batch of shops: some pass, some fail."""
        shops = [
            {"id": "shop-ok", "google_maps_url": "https://maps.google.com/place/ok"},
            {"id": "shop-bad", "google_maps_url": "https://maps.google.com/place/bad"},
        ]
        select_chain = MagicMock()
        select_chain.execute.return_value = MagicMock(data=shops)
        mock_db.table.return_value.select.return_value.eq.return_value = select_chain

        update_chain = MagicMock()
        update_chain.in_.return_value.execute.return_value = MagicMock()
        mock_db.table.return_value.update.return_value = update_chain

        ok_response = AsyncMock()
        ok_response.status_code = 200
        bad_response = AsyncMock()
        bad_response.status_code = 404

        async def mock_head(url, **kwargs):
            if "ok" in url:
                return ok_response
            return bad_response

        with patch("workers.handlers.check_urls.httpx.AsyncClient") as MockClient:
            client_instance = AsyncMock()
            client_instance.head = AsyncMock(side_effect=mock_head)
            MockClient.return_value.__aenter__ = AsyncMock(return_value=client_instance)
            MockClient.return_value.__aexit__ = AsyncMock(return_value=False)

            result = await check_urls_for_region(mock_db)

        assert result == {"checked": 2, "passed": 1, "failed": 1, "errored": 0}
