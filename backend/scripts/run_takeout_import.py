"""Import Google Takeout saved places into the shop pipeline.

Usage (run from backend/):
    uv run python scripts/run_takeout_import.py "/path/to/Saved Places.json"
    uv run python scripts/run_takeout_import.py /path/to/saved_places.csv

Supports both GeoJSON (.json) and CSV (.csv) exports.
GeoJSON: includes coordinates — geo-bounds filtering applies (defaults to Greater Taipei).
CSV:     no coordinates — scraper fills them in after URL validation.
"""

import asyncio
import json
import sys
from pathlib import Path

import structlog

from db.supabase_client import get_service_role_client
from importers.google_takeout import (
    import_takeout_to_queue,
    parse_takeout_csv,
    parse_takeout_geojson,
)

logger = structlog.get_logger()


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: uv run python scripts/run_takeout_import.py <path/to/file>")
        sys.exit(1)

    path = Path(sys.argv[1])
    if not path.exists():
        print(f"Error: file not found: {path}")
        sys.exit(1)

    suffix = path.suffix.lower()
    if suffix == ".json":
        geojson = json.loads(path.read_text(encoding="utf-8"))
        places = parse_takeout_geojson(geojson)
        region_name = "greater_taipei"
    elif suffix == ".csv":
        places = parse_takeout_csv(path.read_text(encoding="utf-8"))
        region_name = "csv_import"
    else:
        print(f"Error: unsupported file type '{suffix}'. Expected .json or .csv")
        sys.exit(1)

    if not places:
        print("No places parsed from file. Check file format and geographic bounds.")
        sys.exit(1)

    print(f"Parsed {len(places)} places from {path.name}")

    db = get_service_role_client()
    result = asyncio.run(import_takeout_to_queue(places, db, region_name=region_name))

    print("\nImport complete:")
    print(f"  Queued for URL check : {result['imported']}")
    print(f"  Filtered out         : {sum(result['filtered'].values())}")
    print(f"    Invalid URL        : {result['filtered']['invalid_url']}")
    print(f"    Invalid name       : {result['filtered']['invalid_name']}")
    print(f"    Known failed       : {result['filtered']['known_failed']}")
    print(f"  Fuzzy duplicates     : {result['flagged_duplicates']}")
    print("\nNext step: start the backend and let workers process SCRAPE_SHOP jobs.")
    print("  cd backend && uvicorn main:app --reload --port 8000")
    print("  Monitor: GET http://localhost:8000/admin/pipeline/jobs?status=pending")


if __name__ == "__main__":
    main()
