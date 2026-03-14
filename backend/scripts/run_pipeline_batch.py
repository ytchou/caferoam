"""Run the full pipeline for N random pending shops.

Usage (run from backend/):
    uv run python scripts/run_pipeline_batch.py [--count 15] [--dry-run] [--seed N]

Speed:  all shops scraped in one Apify run (single cold start).
        enrich/embed/publish run concurrently (semaphore = worker_concurrency_enrich).
Filter: non-Taiwan shops stopped after scraping — no Claude/OpenAI spend on them.
DB:     each run is tracked in batch_runs + batch_run_shops for admin dashboard.
"""

import asyncio
import random
import sys
import time
import uuid
from datetime import UTC, datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.config import settings
from core.db import first
from db.supabase_client import get_service_role_client
from models.types import TaxonomyTag
from providers.embeddings import get_embeddings_provider
from providers.llm import get_llm_provider
from providers.scraper import get_scraper_provider
from providers.scraper.interface import BatchScrapeInput
from workers.handlers.enrich_shop import handle_enrich_shop
from workers.handlers.generate_embedding import handle_generate_embedding
from workers.handlers.publish_shop import handle_publish_shop
from workers.persist import persist_scraped_data
from workers.queue import JobQueue

# ── Live display ───────────────────────────────────────────────────────────────

_STEP_ICONS = {
    "pending": "·····",
    "scraping": "SCRAPE",
    "enriching": "ENRICH",
    "embedding": "EMBED ",
    "publishing": "PUB   ",
    "live": "✓ LIVE",
    "out_of_region": "~ OOR ",
    "not_found": "✗ 404 ",
    "error": "✗ ERR ",
}
_STEP_PROGRESS = {
    "scraping": 1,
    "enriching": 2,
    "embedding": 3,
    "publishing": 3,
    "live": 4,
    "out_of_region": 1,
    "not_found": 1,
    "error": 2,
    "pending": 0,
}
_WIDTH = 10


def _bar(step: str) -> str:
    filled = int(_WIDTH * _STEP_PROGRESS.get(step, 0) / 4)
    return f"{'█' * filled}{'░' * (_WIDTH - filled)}"


def _fmt(s: float) -> str:
    return f"{int(s // 60)}m{int(s % 60):02d}s" if s >= 60 else f"{s:5.1f}s"


class LiveDisplay:
    """Rewrite individual rows in-place using ANSI escape codes."""

    def __init__(self, rows: list[str]) -> None:
        self._rows = list(rows)
        self._n = len(rows)
        print("\n".join(self._rows), flush=True)

    def update(self, idx: int, new_row: str) -> None:
        self._rows[idx] = new_row
        up = self._n - idx
        sys.stdout.write(f"\033[{up}A\033[2K\r{new_row}\033[{up - 1}B\r")
        sys.stdout.flush()

    def done(self) -> None:
        sys.stdout.write(f"\033[{self._n}B\n")
        sys.stdout.flush()


def _shop_row(
    idx: int, total: int, name: str, step: str, elapsed: float | None, extra: str = ""
) -> str:
    icon = _STEP_ICONS.get(step, step)
    bar = _bar(step)
    t = _fmt(elapsed) if elapsed is not None else "  --  "
    ex = f"  {extra}" if extra else ""
    return f"  {idx:>2}/{total}  {name:<32}  [{bar}]  {icon}  {t}{ex}"


# ── Pre-flight ─────────────────────────────────────────────────────────────────


def check_providers() -> list[str]:
    errors: list[str] = []
    for label, fn in [
        ("scraper", get_scraper_provider),
        ("llm", get_llm_provider),
        ("embeddings", get_embeddings_provider),
    ]:
        try:
            fn()
        except Exception as e:
            errors.append(f"{label}: {e}")
    return errors


def check_db(db) -> list[str]:
    errors: list[str] = []
    for table in ("job_queue", "taxonomy_tags", "batch_runs", "batch_run_shops"):
        try:
            db.table(table).select("id").limit(1).execute()
        except Exception as e:
            errors.append(f"{table}: {e}")
    return errors


# ── DB tracking helpers ────────────────────────────────────────────────────────


def db_create_batch_run(db, batch_id: str, total: int) -> str:
    row = (
        db.table("batch_runs")
        .insert(
            {
                "batch_id": batch_id,
                "total": total,
                "status": "running",
            }
        )
        .execute()
    )
    return first(row.data, "batch_runs insert")["id"]


def db_create_shop_row(db, batch_run_id: str, shop_id: str, name: str) -> str:
    row = (
        db.table("batch_run_shops")
        .insert(
            {
                "batch_run_id": batch_run_id,
                "shop_id": shop_id,
                "shop_name": name,
                "status": "pending",
            }
        )
        .execute()
    )
    return first(row.data, "batch_run_shops insert")["id"]


def db_update_shop_row(db, row_id: str, **kwargs) -> None:
    db.table("batch_run_shops").update(kwargs).eq("id", row_id).execute()


def db_complete_batch(db, batch_run_id: str, counts: dict) -> None:
    db.table("batch_runs").update(
        {
            "status": "completed",
            "completed_at": datetime.now(UTC).isoformat(),
            **counts,
        }
    ).eq("id", batch_run_id).execute()


# ── Shop selection ─────────────────────────────────────────────────────────────


def pick_shops(db, count: int, seed: int) -> list[dict]:
    rows = (
        db.table("shops")
        .select("id,name,google_maps_url")
        .eq("processing_status", "pending")
        .execute()
    )
    with_url = [s for s in rows.data if s.get("google_maps_url")]
    random.seed(seed)
    return random.sample(with_url, min(count, len(with_url)))


# ── Per-shop pipeline ──────────────────────────────────────────────────────────


async def run_shop_pipeline(
    shop_id: str,
    name: str,
    idx: int,
    total: int,
    db,
    queue: JobQueue,
    sem: asyncio.Semaphore,
    display: LiveDisplay,
    db_row_id: str,
    start_time: float,
) -> dict:
    result: dict = {"shop_id": shop_id, "name": name, "timings": {}}

    def _elapsed() -> float:
        return time.monotonic() - start_time

    async def _step(step: str, coro) -> bool:
        t0 = time.monotonic()
        display.update(idx, _shop_row(idx + 1, total, name, step, _elapsed()))
        db_update_shop_row(db, db_row_id, status=step)
        try:
            await coro
            result["timings"][step] = time.monotonic() - t0
            return True
        except Exception as e:
            result["timings"][step] = time.monotonic() - t0
            result["error"] = str(e)
            display.update(idx, _shop_row(idx + 1, total, name, "error", _elapsed(), str(e)[:40]))
            db_update_shop_row(
                db,
                db_row_id,
                status="error",
                error_message=str(e)[:500],
                completed_at=datetime.now(UTC).isoformat(),
            )
            return False

    async with sem:
        taxonomy = [TaxonomyTag(**t) for t in db.table("taxonomy_tags").select("*").execute().data]

        ok = await _step(
            "enriching",
            handle_enrich_shop(
                payload={"shop_id": shop_id},
                db=db,
                llm=get_llm_provider(taxonomy=taxonomy),
                queue=queue,
            ),
        )
        if not ok:
            return result

        ok = await _step(
            "embedding",
            handle_generate_embedding(
                payload={"shop_id": shop_id},
                db=db,
                embeddings=get_embeddings_provider(),
                queue=queue,
            ),
        )
        if not ok:
            return result

        ok = await _step(
            "publishing",
            handle_publish_shop(
                payload={"shop_id": shop_id},
                db=db,
            ),
        )
        if not ok:
            return result

    t = result["timings"]
    summary = f"enrich={_fmt(t.get('enriching', 0))}  embed={_fmt(t.get('embedding', 0))}"
    display.update(idx, _shop_row(idx + 1, total, name, "live", _elapsed(), summary))
    db_update_shop_row(
        db,
        db_row_id,
        status="live",
        enrich_elapsed_s=round(t.get("enriching", 0), 2),
        embed_elapsed_s=round(t.get("embedding", 0), 2),
        publish_elapsed_s=round(t.get("publishing", 0), 2),
        completed_at=datetime.now(UTC).isoformat(),
    )
    result["status"] = "live"
    return result


# ── Main ───────────────────────────────────────────────────────────────────────


async def main(count: int, dry_run: bool, seed: int) -> None:
    run_start = time.monotonic()
    print(f"\n=== CafeRoam Pipeline Batch Runner  (seed={seed}) ===\n")

    # Pre-flight
    print("Pre-flight…", end=" ", flush=True)
    errors = check_providers()
    db = get_service_role_client()
    errors += check_db(db)
    if errors:
        print("FAILED")
        for e in errors:
            print(f"  ✗ {e}")
        sys.exit(1)
    print("ok\n")

    # Shop selection
    shops = pick_shops(db, count, seed)
    live_count = len(db.table("shops").select("id").eq("processing_status", "live").execute().data)
    pending_count = len(
        db.table("shops").select("id").eq("processing_status", "pending").execute().data
    )
    print(
        f"DB: {live_count} live, {pending_count} pending  →  selecting {len(shops)} for this run\n"
    )
    print(f"  {'#':>2}  {'Name'}")
    print(f"  {'─' * 2}  {'─' * 42}")
    for i, s in enumerate(shops, 1):
        print(f"  {i:>2}. {s['name']}")

    if dry_run:
        print("\nDry-run — stopping here.")
        return

    batch_id = str(uuid.uuid4())
    queue = JobQueue(db)
    scraper = get_scraper_provider()

    # Create batch_run record
    batch_run_id = db_create_batch_run(db, batch_id, len(shops))
    print(f"\nbatch_id: {batch_id[:8]}…  run_id: {batch_run_id[:8]}…")

    # ── Step 1: Apify batch scrape ─────────────────────────────────────────────
    print(f"\n{'─' * 60}")
    print(f"STEP 1/4  Scraping {len(shops)} shops  (single Apify run)")
    print(f"{'─' * 60}")
    t_scrape = time.monotonic()
    print("  Waiting for Apify…", end=" ", flush=True)

    batch_inputs = [
        BatchScrapeInput(shop_id=s["id"], google_maps_url=s["google_maps_url"]) for s in shops
    ]
    batch_results = await scraper.scrape_batch(batch_inputs)
    scrape_elapsed = time.monotonic() - t_scrape
    print(f"done  ({_fmt(scrape_elapsed)})\n")

    shop_by_id = {s["id"]: s for s in shops}
    taiwan_shops: list[dict] = []
    out_of_region: list[str] = []
    not_found: list[str] = []

    # Create batch_run_shops rows and persist scrape results
    shop_db_rows: dict[str, str] = {}  # shop_id → batch_run_shops.id
    for s in shops:
        shop_db_rows[s["id"]] = db_create_shop_row(db, batch_run_id, s["id"], s["name"])

    for r in batch_results:
        name = shop_by_id[r.shop_id]["name"]
        row_id = shop_db_rows[r.shop_id]

        if r.data is None:
            print(f"  ✗ {name[:45]}  — not found on Google Maps")
            not_found.append(name)
            db.table("shops").update({"processing_status": "failed"}).eq("id", r.shop_id).execute()
            db_update_shop_row(
                db,
                row_id,
                status="not_found",
                scrape_elapsed_s=round(scrape_elapsed, 2),
                completed_at=datetime.now(UTC).isoformat(),
            )
            continue

        await persist_scraped_data(
            shop_id=r.shop_id, data=r.data, db=db, queue=queue, batch_id=batch_id
        )
        status = (
            db.table("shops")
            .select("processing_status")
            .eq("id", r.shop_id)
            .single()
            .execute()
            .data["processing_status"]
        )

        if status == "out_of_region":
            country = r.data.country_code or "??"
            print(f"  ~ {name[:45]}  — out of region [{country}]  {r.data.address[:35]}")
            out_of_region.append(name)
            db_update_shop_row(
                db,
                row_id,
                status="out_of_region",
                rejection_reason=f"country_code={country}",
                scrape_elapsed_s=round(scrape_elapsed, 2),
                completed_at=datetime.now(UTC).isoformat(),
            )
        else:
            print(f"  ✓ {name[:45]}  — {r.data.address[:45]}")
            taiwan_shops.append({"id": r.shop_id, "name": name})
            db_update_shop_row(
                db, row_id, status="enriching", scrape_elapsed_s=round(scrape_elapsed, 2)
            )

    tw, oor, nf = len(taiwan_shops), len(out_of_region), len(not_found)
    print(f"\n  Taiwan: {tw}  |  Out of region: {oor}  |  Not found: {nf}")

    if not taiwan_shops:
        db_complete_batch(
            db,
            batch_run_id,
            {
                "taiwan": 0,
                "out_of_region": len(out_of_region),
                "not_found": len(not_found),
                "scraped": len(shops),
            },
        )
        print("\nNo Taiwan shops to enrich. Done.")
        return

    # ── Steps 2-4: concurrent enrich → embed → publish ────────────────────────
    n = len(taiwan_shops)
    concurrency = settings.worker_concurrency_enrich
    print(f"\n{'─' * 60}")
    print(f"STEPS 2–4  Enrich → Embed → Publish  ({n} shops, concurrency={concurrency})")
    print(f"{'─' * 60}\n")

    # Print initial rows (all pending) — LiveDisplay takes over from here
    initial_rows = [
        _shop_row(i + 1, n, s["name"], "pending", None) for i, s in enumerate(taiwan_shops)
    ]
    display = LiveDisplay(initial_rows)

    sem = asyncio.Semaphore(concurrency)
    enrich_start = time.monotonic()

    tasks = [
        run_shop_pipeline(
            shop_id=s["id"],
            name=s["name"],
            idx=i,
            total=n,
            db=db,
            queue=queue,
            sem=sem,
            display=display,
            db_row_id=shop_db_rows[s["id"]],
            start_time=enrich_start,
        )
        for i, s in enumerate(taiwan_shops)
    ]
    results = await asyncio.gather(*tasks)
    enrich_elapsed = time.monotonic() - enrich_start
    display.done()

    # ── Summary ────────────────────────────────────────────────────────────────
    total_elapsed = time.monotonic() - run_start
    ok = [r for r in results if r.get("status") == "live"]
    errors = [r for r in results if r.get("status") != "live"]
    new_live = len(db.table("shops").select("id").eq("processing_status", "live").execute().data)

    enrich_times = [
        r["timings"].get("enriching", 0) for r in results if "enriching" in r.get("timings", {})
    ]
    avg_enrich = sum(enrich_times) / len(enrich_times) if enrich_times else 0

    db_complete_batch(
        db,
        batch_run_id,
        {
            "scraped": len(shops),
            "taiwan": len(taiwan_shops),
            "out_of_region": len(out_of_region),
            "not_found": len(not_found),
            "live": len(ok),
            "errors": len(errors),
        },
    )

    print(f"{'─' * 60}")
    print("  SUMMARY")
    print(f"{'─' * 60}")
    print(f"  Total wall time      {_fmt(total_elapsed)}")
    print(f"  Apify batch          {_fmt(scrape_elapsed)}  ({len(shops)} shops, 1 cold start)")
    print(f"  Enrich+embed+pub     {_fmt(enrich_elapsed)}  (concurrency={concurrency})")
    print(f"  Avg enrich/shop      {_fmt(avg_enrich)}")
    print()
    print(f"  Scraped              {len(shops)}")
    print(f"  Out of region        {len(out_of_region)}")
    print(f"  Not found            {len(not_found)}")
    print(f"  Live this run        {len(ok)}")
    print(f"  Errors               {len(errors)}")
    print(f"  DB total live now    {new_live}")
    if out_of_region:
        print(f"\n  Out of region: {', '.join(out_of_region)}")
    if errors:
        print("\n  Errors:")
        for r in errors:
            print(f"    ✗ {r['name']}  {r.get('error', '')[:70]}")
    print(f"{'─' * 60}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser()
    parser.add_argument("--count", type=int, default=15)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--seed", type=int, default=99)
    args = parser.parse_args()
    asyncio.run(main(count=args.count, dry_run=args.dry_run, seed=args.seed))
