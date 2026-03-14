"""Tests for the scrape_batch worker handler."""

from unittest.mock import AsyncMock, MagicMock

import pytest

from providers.scraper.interface import BatchScrapeInput, BatchScrapeResult, ScrapedShopData
from workers.handlers.scrape_batch import handle_scrape_batch

_BATCH_ID = "b1a2c3d4-e5f6-7890-abcd-ef1234567890"
_SHOP_ID_A = "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
_SHOP_ID_B = "b2c3d4e5-f6a7-8901-bcde-f12345678901"
_URL_A = "https://maps.google.com/?cid=11111111111111111"
_URL_B = "https://maps.google.com/?cid=22222222222222222"


@pytest.fixture
def scraped_data_a():
    return ScrapedShopData(
        name="慢靜岸咖啡",
        address="台北市大安區仁愛路四段300巷12號",
        latitude=25.033,
        longitude=121.565,
        google_place_id="ChIJtest_a",
        rating=4.8,
        review_count=120,
        country_code="TW",
        reviews=[{"text": "環境舒適，咖啡香濃", "stars": 5, "published_at": "2026-01-15"}],
        photo_urls=["https://img.example.com/a.jpg"],
    )


@pytest.fixture
def scraped_data_b():
    return ScrapedShopData(
        name="日光豆行",
        address="台北市信義區忠孝東路五段100號",
        latitude=25.040,
        longitude=121.570,
        google_place_id="ChIJtest_b",
        rating=4.5,
        review_count=80,
        country_code="TW",
        reviews=[],
        photo_urls=[],
    )


@pytest.fixture
def mock_db():
    db = MagicMock()
    db.table.return_value.update.return_value.in_.return_value.execute.return_value = MagicMock()
    db.table.return_value.update.return_value.eq.return_value.execute.return_value = MagicMock()
    db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[]
    )
    db.table.return_value.delete.return_value.eq.return_value.execute.return_value = MagicMock()
    db.table.return_value.insert.return_value.execute.return_value = MagicMock()
    db.table.return_value.upsert.return_value.execute.return_value = MagicMock()
    return db


@pytest.fixture
def mock_queue():
    queue = MagicMock()
    queue.enqueue = AsyncMock(return_value="job-enrich-001")
    return queue


@pytest.mark.asyncio
async def test_all_shops_scraped_successfully_enqueues_enrichment(
    mock_db, mock_queue, scraped_data_a, scraped_data_b
):
    """When all shops scrape successfully, each gets an ENRICH_SHOP job queued."""
    mock_scraper = AsyncMock()
    mock_scraper.scrape_batch.return_value = [
        BatchScrapeResult(shop_id=_SHOP_ID_A, data=scraped_data_a),
        BatchScrapeResult(shop_id=_SHOP_ID_B, data=scraped_data_b),
    ]
    payload = {
        "batch_id": _BATCH_ID,
        "shops": [
            {"shop_id": _SHOP_ID_A, "google_maps_url": _URL_A},
            {"shop_id": _SHOP_ID_B, "google_maps_url": _URL_B},
        ],
    }

    await handle_scrape_batch(payload=payload, db=mock_db, scraper=mock_scraper, queue=mock_queue)

    # All shops initially set to "scraping" in a single batch UPDATE
    mock_db.table.return_value.update.return_value.in_.assert_called()

    # ENRICH_SHOP enqueued for each shop
    assert mock_queue.enqueue.call_count == 2
    enqueued_types = [c.kwargs["job_type"].value for c in mock_queue.enqueue.call_args_list]
    assert enqueued_types == ["enrich_shop", "enrich_shop"]

    # Scraper was called once (one Apify actor run)
    mock_scraper.scrape_batch.assert_called_once()
    inputs = mock_scraper.scrape_batch.call_args.args[0]
    assert len(inputs) == 2
    assert all(isinstance(i, BatchScrapeInput) for i in inputs)


@pytest.mark.asyncio
async def test_shop_not_found_on_google_maps_marks_failed_without_aborting_batch(
    mock_db, mock_queue, scraped_data_b
):
    """A shop returning None from Apify is marked failed; remaining shops are still processed."""
    mock_scraper = AsyncMock()
    mock_scraper.scrape_batch.return_value = [
        BatchScrapeResult(shop_id=_SHOP_ID_A, data=None),  # not found
        BatchScrapeResult(shop_id=_SHOP_ID_B, data=scraped_data_b),
    ]
    payload = {
        "batch_id": _BATCH_ID,
        "shops": [
            {"shop_id": _SHOP_ID_A, "google_maps_url": _URL_A},
            {"shop_id": _SHOP_ID_B, "google_maps_url": _URL_B},
        ],
    }

    await handle_scrape_batch(payload=payload, db=mock_db, scraper=mock_scraper, queue=mock_queue)

    # Only one ENRICH_SHOP job (shop B succeeded; shop A failed)
    assert mock_queue.enqueue.call_count == 1
    enrich_payload = mock_queue.enqueue.call_args.kwargs["payload"]
    assert enrich_payload["shop_id"] == _SHOP_ID_B

    # Shop A should be marked "failed"
    update_calls = mock_db.table.return_value.update.call_args_list
    failed_status_updates = [
        c for c in update_calls if c.args and c.args[0].get("processing_status") == "failed"
    ]
    assert failed_status_updates, "Expected at least one failed status update"
    # Verify shop A specifically was targeted (.eq("id", _SHOP_ID_A) was called)
    eq_calls = mock_db.table.return_value.update.return_value.eq.call_args_list
    assert any(c.args == ("id", _SHOP_ID_A) for c in eq_calls), (
        f"Expected shop A ({_SHOP_ID_A}) to be targeted in failed update"
    )


@pytest.mark.asyncio
async def test_persist_failure_marks_shop_failed_and_continues_remaining(
    mock_db, mock_queue, scraped_data_a, scraped_data_b
):
    """A persist error for one shop marks it failed; the batch still processes remaining shops."""
    mock_scraper = AsyncMock()
    mock_scraper.scrape_batch.return_value = [
        BatchScrapeResult(shop_id=_SHOP_ID_A, data=scraped_data_a),
        BatchScrapeResult(shop_id=_SHOP_ID_B, data=scraped_data_b),
    ]

    # Simulate: shop A's review insert fails
    insert_mock = MagicMock()
    insert_mock.execute.side_effect = [Exception("DB constraint error"), MagicMock(), MagicMock()]
    mock_db.table.return_value.insert.return_value = insert_mock
    mock_db.table.return_value.select.return_value.eq.return_value.execute.return_value = MagicMock(
        data=[]
    )

    payload = {
        "batch_id": _BATCH_ID,
        "shops": [
            {"shop_id": _SHOP_ID_A, "google_maps_url": _URL_A},
            {"shop_id": _SHOP_ID_B, "google_maps_url": _URL_B},
        ],
    }

    # Batch handler should NOT raise — it catches per-shop errors
    await handle_scrape_batch(payload=payload, db=mock_db, scraper=mock_scraper, queue=mock_queue)

    # Shop B still enqueued for enrichment (shop A failed, shop B succeeded)
    assert mock_queue.enqueue.call_count == 1
    enrich_payload = mock_queue.enqueue.call_args.kwargs["payload"]
    assert enrich_payload["shop_id"] == _SHOP_ID_B


@pytest.mark.asyncio
async def test_empty_batch_payload_is_a_no_op(mock_db, mock_queue):
    """An empty shops list logs a warning and returns without calling the scraper."""
    mock_scraper = AsyncMock()
    payload = {"batch_id": _BATCH_ID, "shops": []}

    await handle_scrape_batch(payload=payload, db=mock_db, scraper=mock_scraper, queue=mock_queue)

    mock_scraper.scrape_batch.assert_not_called()
    mock_queue.enqueue.assert_not_called()


@pytest.mark.asyncio
async def test_submission_context_forwarded_to_enrichment_job(mock_db, mock_queue, scraped_data_a):
    """Submission ID and submitted_by are forwarded to the ENRICH_SHOP payload."""
    mock_scraper = AsyncMock()
    mock_scraper.scrape_batch.return_value = [
        BatchScrapeResult(shop_id=_SHOP_ID_A, data=scraped_data_a),
    ]
    payload = {
        "batch_id": _BATCH_ID,
        "shops": [
            {
                "shop_id": _SHOP_ID_A,
                "google_maps_url": _URL_A,
                "submission_id": "sub-00000001-0000-0000-0000-000000000001",
                "submitted_by": "user-00000001-0000-0000-0000-000000000001",
            }
        ],
    }

    await handle_scrape_batch(payload=payload, db=mock_db, scraper=mock_scraper, queue=mock_queue)

    enrich_payload = mock_queue.enqueue.call_args.kwargs["payload"]
    assert enrich_payload["submission_id"] == "sub-00000001-0000-0000-0000-000000000001"
    assert enrich_payload["submitted_by"] == "user-00000001-0000-0000-0000-000000000001"
    assert enrich_payload["batch_id"] == _BATCH_ID
