from unittest.mock import MagicMock

import pytest

from core.regions import REGIONS, GeoBounds
from importers.google_takeout import import_takeout_to_queue, parse_takeout_places

_GREATER_TAIPEI_BOUNDS = REGIONS["greater_taipei"].bounds

_GEOJSON_TAIPEI = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"coordinates": [121.565, 25.033]},
            "properties": {
                "Title": "慢靜岸咖啡",
                "Google Maps URL": "https://maps.google.com/?cid=12345678901234567",
                "Location": {"Address": "台北市大安區仁愛路四段300巷12號"},
            },
        },
    ],
}


def test_parse_takeout_filters_to_region_bounds():
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"coordinates": [121.565, 25.033]},
                "properties": {
                    "Title": "Taipei Cafe",
                    "Google Maps URL": "https://maps.google.com/?cid=123",
                    "Location": {"Address": "123 Taipei St"},
                },
            },
            {
                "type": "Feature",
                "geometry": {"coordinates": [-73.935, 40.730]},
                "properties": {
                    "Title": "NYC Coffee",
                    "Google Maps URL": "https://maps.google.com/?cid=456",
                    "Location": {"Address": "NYC"},
                },
            },
        ],
    }

    results = parse_takeout_places(geojson, bounds=_GREATER_TAIPEI_BOUNDS)
    assert len(results) == 1
    assert results[0]["name"] == "Taipei Cafe"


def test_parse_takeout_accepts_custom_bounds():
    custom_bounds = GeoBounds(min_lat=40.0, max_lat=41.0, min_lng=-74.0, max_lng=-73.0)
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"coordinates": [-73.935, 40.730]},
                "properties": {
                    "Title": "NYC Coffee",
                    "Google Maps URL": "https://maps.google.com/?cid=456",
                    "Location": {"Address": "NYC"},
                },
            },
        ],
    }
    results = parse_takeout_places(geojson, bounds=custom_bounds)
    assert len(results) == 1
    assert results[0]["name"] == "NYC Coffee"


def test_parse_takeout_extracts_google_maps_url():
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"coordinates": [121.5, 25.0]},
                "properties": {
                    "Title": "Test",
                    "Google Maps URL": "https://maps.google.com/?cid=789",
                    "Location": {"Address": "Test St"},
                },
            },
        ],
    }

    results = parse_takeout_places(geojson, bounds=_GREATER_TAIPEI_BOUNDS)
    assert results[0]["google_maps_url"] == "https://maps.google.com/?cid=789"


def _build_mock_db_no_existing() -> MagicMock:
    """DB with no matching shops for any pre-filter check."""
    db = MagicMock()
    # existing_shops (bounds query) — return empty list
    db.table.return_value.select.return_value.gte.return_value.lte.return_value.gte.return_value.lte.return_value.execute.return_value = MagicMock(  # noqa: E501
        data=[]
    )
    # failed_shops (processing_status=failed + bounds) — return empty list
    db.table.return_value.select.return_value.eq.return_value.gte.return_value.lte.return_value.gte.return_value.lte.return_value.execute.return_value = MagicMock(  # noqa: E501
        data=[]
    )
    db.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[{"id": "new-shop-1"}]
    )
    return db


@pytest.fixture
def mock_db_no_existing() -> MagicMock:
    return _build_mock_db_no_existing()


@pytest.fixture
def mock_db_existing() -> MagicMock:
    """DB with an existing matching shop — in-memory exact dedup skips the import."""
    db = MagicMock()
    # existing_shops returns a shop matching 慢靜岸咖啡 at the same coordinates
    db.table.return_value.select.return_value.gte.return_value.lte.return_value.gte.return_value.lte.return_value.execute.return_value = MagicMock(  # noqa: E501
        data=[
            {
                "id": "existing-shop-1",
                "name": "慢靜岸咖啡",
                "latitude": "25.033",
                "longitude": "121.565",
            }
        ]
    )
    # failed_shops — empty
    db.table.return_value.select.return_value.eq.return_value.gte.return_value.lte.return_value.gte.return_value.lte.return_value.execute.return_value = MagicMock(  # noqa: E501
        data=[]
    )
    return db


@pytest.mark.asyncio
async def test_admin_uploading_valid_takeout_file_imports_shops(mock_db_no_existing):
    result = await import_takeout_to_queue(
        _GEOJSON_TAIPEI, mock_db_no_existing, bounds=_GREATER_TAIPEI_BOUNDS
    )
    assert result["imported"] == 1
    assert "filtered" in result
    assert "pending_url_check" in result


@pytest.mark.asyncio
async def test_imported_takeout_shops_are_staged_for_url_validation(mock_db_no_existing):
    """Shops are inserted with pending_url_check status and google_maps_url stored."""
    await import_takeout_to_queue(
        _GEOJSON_TAIPEI, mock_db_no_existing, bounds=_GREATER_TAIPEI_BOUNDS
    )
    insert_call = mock_db_no_existing.table.return_value.insert.call_args
    inserted_data = insert_call.args[0]
    assert inserted_data["processing_status"] == "pending_url_check"
    assert inserted_data["google_maps_url"] == "https://maps.google.com/?cid=12345678901234567"


@pytest.mark.asyncio
async def test_duplicate_takeout_place_is_not_imported_twice(mock_db_existing):
    result = await import_takeout_to_queue(
        _GEOJSON_TAIPEI, mock_db_existing, bounds=_GREATER_TAIPEI_BOUNDS
    )
    assert result["imported"] == 0


@pytest.mark.asyncio
async def test_takeout_places_with_non_google_maps_url_are_filtered_before_import():
    """Places with non-Google Maps URLs are filtered out before reaching the DB."""
    geojson = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {"coordinates": [121.565, 25.033]},
                "properties": {
                    "Title": "慢靜岸咖啡",
                    "Google Maps URL": "https://example.com/cafe",
                    "Location": {"Address": "台北市大安區仁愛路四段300巷12號"},
                },
            },
        ],
    }
    db = _build_mock_db_no_existing()
    result = await import_takeout_to_queue(geojson, db, bounds=_GREATER_TAIPEI_BOUNDS)
    assert result["imported"] == 0
    assert result["filtered"]["invalid_url"] == 1


_GEOJSON_TWO_PLACES = {
    "type": "FeatureCollection",
    "features": [
        {
            "type": "Feature",
            "geometry": {"coordinates": [121.565, 25.033]},
            "properties": {
                "Title": "慢靜岸咖啡",
                "Google Maps URL": "https://maps.google.com/?cid=11111111111111111",
                "Location": {"Address": "台北市大安區仁愛路四段300巷12號"},
            },
        },
        {
            "type": "Feature",
            "geometry": {"coordinates": [121.566, 25.034]},
            "properties": {
                "Title": "裊裊炊煙咖啡",
                "Google Maps URL": "https://maps.google.com/?cid=22222222222222222",
                "Location": {"Address": "台北市信義區松仁路100號"},
            },
        },
    ],
}


@pytest.mark.asyncio
async def test_takeout_import_continues_when_one_shop_fails_to_insert():
    """If inserting one place raises, the import continues and imports the others."""
    db = MagicMock()
    # existing_shops (bounds) → empty
    db.table.return_value.select.return_value.gte.return_value.lte.return_value.gte.return_value.lte.return_value.execute.return_value = MagicMock(  # noqa: E501
        data=[]
    )
    # failed_shops (status + bounds) → empty
    db.table.return_value.select.return_value.eq.return_value.gte.return_value.lte.return_value.gte.return_value.lte.return_value.execute.return_value = MagicMock(  # noqa: E501
        data=[]
    )

    first_insert = MagicMock()
    first_insert.execute.side_effect = Exception("DB timeout")
    second_insert = MagicMock()
    second_insert.execute.return_value = MagicMock(data=[{"id": "shop-2"}])
    db.table.return_value.insert.side_effect = [first_insert, second_insert]

    result = await import_takeout_to_queue(_GEOJSON_TWO_PLACES, db, bounds=_GREATER_TAIPEI_BOUNDS)

    assert result["imported"] == 1


@pytest.mark.asyncio
async def test_takeout_import_reports_zero_when_all_inserts_fail():
    """When all DB inserts fail, the import reports 0 imported shops."""
    db = _build_mock_db_no_existing()
    db.table.return_value.insert.return_value.execute.side_effect = Exception("DB unavailable")

    result = await import_takeout_to_queue(_GEOJSON_TAIPEI, db, bounds=_GREATER_TAIPEI_BOUNDS)

    assert result["imported"] == 0
