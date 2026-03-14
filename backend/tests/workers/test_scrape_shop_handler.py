from unittest.mock import AsyncMock, MagicMock

import pytest

from providers.scraper.interface import ScrapedShopData
from workers.handlers.scrape_shop import handle_scrape_shop


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()
    db.table.return_value.upsert.return_value.execute.return_value = MagicMock()
    db.table.return_value.insert.return_value.execute.return_value = MagicMock()
    return db


@pytest.fixture
def mock_scraper():
    return AsyncMock()


@pytest.fixture
def mock_queue():
    queue = MagicMock()
    queue.enqueue = AsyncMock(return_value="job-2")
    return queue


@pytest.fixture
def scraped_data():
    return ScrapedShopData(
        name="Test Cafe",
        address="123 Test St",
        latitude=25.033,
        longitude=121.565,
        google_place_id="ChIJ_test",
        rating=4.5,
        review_count=42,
        country_code="TW",
        phone="+886-2-1234",
        website="https://test.tw",
        reviews=[
            {"text": "Great coffee", "stars": 5, "published_at": "2026-01-01"},
        ],
        photo_urls=["https://img1.jpg"],
    )


@pytest.mark.asyncio
async def test_scrape_shop_success(mock_db, mock_scraper, mock_queue, scraped_data):
    mock_scraper.scrape_by_url.return_value = scraped_data
    payload = {"shop_id": "shop-1", "google_maps_url": "https://maps.google.com/?cid=123"}

    await handle_scrape_shop(payload=payload, db=mock_db, scraper=mock_scraper, queue=mock_queue)

    # Should update shop with scraped data
    mock_db.table.assert_any_call("shops")
    # Should queue ENRICH_SHOP
    mock_queue.enqueue.assert_called_once()
    enqueue_call = mock_queue.enqueue.call_args
    assert enqueue_call.kwargs["job_type"].value == "enrich_shop"


@pytest.mark.asyncio
async def test_scrape_shop_restores_reviews_on_insert_failure(
    mock_scraper, mock_queue, scraped_data
):
    """If review insert fails, old reviews are restored."""
    db = MagicMock()
    db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()
    db.table.return_value.upsert.return_value.execute.return_value = MagicMock()

    # Simulate: select returns existing reviews, delete succeeds, insert raises
    old_reviews = [
        {"shop_id": "shop-1", "text": "Old review", "stars": 4, "published_at": "2025-01-01"}
    ]
    db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=old_reviews
    )
    db.table.return_value.delete.return_value.eq.return_value.execute.return_value = MagicMock()
    # First insert raises, second insert (restore) succeeds
    insert_mock = MagicMock()
    insert_mock.execute.side_effect = [Exception("DB error"), MagicMock()]
    db.table.return_value.insert.return_value = insert_mock

    mock_scraper.scrape_by_url.return_value = scraped_data
    payload = {"shop_id": "shop-1", "google_maps_url": "https://maps.google.com/?cid=123"}

    # Handler raises so the scheduler can mark the job failed for retry
    with pytest.raises(Exception, match="DB error"):
        await handle_scrape_shop(payload=payload, db=db, scraper=mock_scraper, queue=mock_queue)

    # Restore insert should have been called with the old reviews
    insert_calls = db.table.return_value.insert.call_args_list
    # First call: new reviews; second call: restore old reviews
    assert len(insert_calls) == 2
    assert insert_calls[1].args[0] == old_reviews
    # Should NOT have proceeded to ENRICH_SHOP
    mock_queue.enqueue.assert_not_called()


@pytest.mark.asyncio
async def test_scrape_shop_not_found_marks_failed(mock_db, mock_scraper, mock_queue):
    mock_scraper.scrape_by_url.return_value = None
    payload = {
        "shop_id": "shop-1",
        "google_maps_url": "https://maps.google.com/?cid=invalid",
        "submission_id": "sub-1",
    }

    # Permanent failure — should return cleanly (no exception) so the worker calls complete()
    await handle_scrape_shop(payload=payload, db=mock_db, scraper=mock_scraper, queue=mock_queue)

    # Should NOT queue ENRICH_SHOP
    mock_queue.enqueue.assert_not_called()
