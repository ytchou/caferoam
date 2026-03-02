from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.regions import REGIONS
from importers.cafe_nomad import fetch_and_import_cafenomad, filter_cafenomad_shops

_GREATER_TAIPEI = REGIONS["greater_taipei"]


def test_filter_removes_closed_shops():
    shops: list[dict[str, Any]] = [
        {
            "id": "1",
            "name": "Open Cafe",
            "latitude": "25.033",
            "longitude": "121.565",
            "closed": None,
        },
        {
            "id": "2",
            "name": "Closed Cafe",
            "latitude": "25.034",
            "longitude": "121.566",
            "closed": "1",
        },
    ]
    filtered, closed_count = filter_cafenomad_shops(shops, _GREATER_TAIPEI)
    assert len(filtered) == 1
    assert filtered[0]["name"] == "Open Cafe"
    assert closed_count == 1


def test_filter_removes_out_of_bounds():
    shops: list[dict[str, Any]] = [
        {
            "id": "1",
            "name": "Taipei Cafe",
            "latitude": "25.033",
            "longitude": "121.565",
            "closed": None,
        },
        {
            "id": "2",
            "name": "Foreign Cafe",
            "latitude": "40.730",
            "longitude": "-73.935",
            "closed": None,
        },
    ]
    filtered, _ = filter_cafenomad_shops(shops, _GREATER_TAIPEI)
    assert len(filtered) == 1


_CAFENOMAD_RAW = [
    {
        "id": "cn-1",
        "name": "Good Cafe",
        "address": "1 Test St",
        "latitude": "25.033",
        "longitude": "121.565",
        "closed": None,
        "url": None,
        "mrt": None,
    },
    {
        "id": "cn-2",
        "name": "Another Cafe",
        "address": "2 Test St",
        "latitude": "25.034",
        "longitude": "121.566",
        "closed": None,
        "url": None,
        "mrt": None,
    },
]


def _build_mock_db(insert_side_effects: list | None = None) -> MagicMock:
    """Build a mock DB that returns no existing shops for all pre-fetch checks."""
    db = MagicMock()
    # existing_shops (bounds query) — return empty list
    db.table.return_value.select.return_value.gte.return_value.lte.return_value.gte.return_value.lte.return_value.execute.return_value = MagicMock(  # noqa: E501
        data=[]
    )
    # failed_shops (processing_status=failed + bounds) — return empty list
    db.table.return_value.select.return_value.eq.return_value.gte.return_value.lte.return_value.gte.return_value.lte.return_value.execute.return_value = MagicMock(  # noqa: E501
        data=[]
    )
    # existing_cafenomad_ids (not_.is_ query) — return empty list
    db.table.return_value.select.return_value.not_.is_.return_value.execute.return_value = (
        MagicMock(  # noqa: E501
            data=[]
        )
    )
    if insert_side_effects is not None:
        db.table.return_value.insert.side_effect = insert_side_effects
    else:
        db.table.return_value.insert.return_value.execute.return_value = MagicMock(
            data=[{"id": "shop-1"}]
        )
    return db


def _make_mock_response(raw: list) -> MagicMock:
    mock_response = MagicMock()
    mock_response.json.return_value = raw
    mock_response.raise_for_status = MagicMock()
    return mock_response


@pytest.mark.asyncio
async def test_cafenomad_import_calls_correct_region_api_endpoint():
    """Import uses the region's cafenomad_city to build the API URL."""
    db = _build_mock_db()
    db.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "shop-1"}]
    )

    with patch("importers.cafe_nomad.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=_make_mock_response(_CAFENOMAD_RAW))
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        await fetch_and_import_cafenomad(db=db, region=_GREATER_TAIPEI)

        call_url = mock_client.get.call_args.args[0]
        assert "taipei" in call_url


@pytest.mark.asyncio
async def test_cafenomad_import_returns_summary_with_required_fields():
    """Import returns a summary dict with the expected keys."""
    db = _build_mock_db()
    db.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "shop-1"}]
    )

    with patch("importers.cafe_nomad.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=_make_mock_response([_CAFENOMAD_RAW[0]]))
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await fetch_and_import_cafenomad(db=db, region=_GREATER_TAIPEI)

    assert "imported" in result
    assert "filtered" in result
    assert "pending_url_check" in result
    assert "flagged_duplicates" in result
    assert result["region"] == "greater_taipei"


@pytest.mark.asyncio
async def test_cafenomad_imported_shops_are_staged_for_url_validation():
    """Imported shops are inserted with pending_url_check status and google_maps_url stored."""
    db = _build_mock_db()
    db.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "shop-1"}]
    )

    with patch("importers.cafe_nomad.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=_make_mock_response([_CAFENOMAD_RAW[0]]))
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        await fetch_and_import_cafenomad(db=db, region=_GREATER_TAIPEI)

    insert_call = db.table.return_value.insert.call_args
    inserted_data = insert_call.args[0]
    assert inserted_data["processing_status"] == "pending_url_check"
    assert "google_maps_url" in inserted_data
    assert (
        "maps.google.com/maps/search" in inserted_data["google_maps_url"]
        or "google.com/maps/search" in inserted_data["google_maps_url"]
    )


@pytest.mark.asyncio
async def test_cafenomad_import_skips_failed_shops_and_continues_importing():
    """If inserting one shop raises, the import continues and imports the others."""
    first_insert = MagicMock()
    first_insert.execute.side_effect = Exception("DB timeout")
    second_insert = MagicMock()
    second_insert.execute.return_value = MagicMock(data=[{"id": "shop-2"}])

    db = _build_mock_db(insert_side_effects=[first_insert, second_insert])

    with patch("importers.cafe_nomad.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=_make_mock_response(_CAFENOMAD_RAW))
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await fetch_and_import_cafenomad(db=db, region=_GREATER_TAIPEI)

    assert result["imported"] == 1


@pytest.mark.asyncio
async def test_cafenomad_reports_zero_imported_when_all_inserts_fail():
    """When all DB inserts fail, the import reports 0 imported shops."""
    db = _build_mock_db()
    db.table.return_value.insert.return_value.execute.side_effect = Exception("DB unavailable")

    with patch("importers.cafe_nomad.httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.get = AsyncMock(return_value=_make_mock_response([_CAFENOMAD_RAW[0]]))
        mock_client_cls.return_value.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client_cls.return_value.__aexit__ = AsyncMock(return_value=False)

        result = await fetch_and_import_cafenomad(db=db, region=_GREATER_TAIPEI)

    assert result["imported"] == 0
