"""Data completeness audit for live shops.

SQL-only: no external API calls, $0 cost.

Usage (run from backend/):
    uv run python scripts/run_coverage_audit.py [--output-dir PATH] [--json-only]
"""

from __future__ import annotations

import asyncio
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from db.supabase_client import get_service_role_client
from scripts.eval_utils import (
    fetch_live_shops,
    print_table,
    print_threshold,
    save_results,
    warn,
)

THRESHOLDS = {
    "photos_present": {"target": 70},
    "reviews_present": {"target": 80},
    "tags_present": {"target": 85},
    "mean_quality": {"target": 60},
}

_WEIGHTS = {"photos": 25, "reviews": 25, "tags": 25, "description": 15, "embedding": 10}


def _score_photos(n: int) -> float:
    if n == 0:
        return 0
    if n <= 2:
        return 50
    if n <= 5:
        return 80
    return 100


def _score_count(n: int) -> float:
    """Score for reviews or tags based on count."""
    if n == 0:
        return 0
    if n <= 2:
        return 40
    if n <= 5:
        return 70
    return 100


def _quality_score(photos: int, reviews: int, tags: int, has_desc: bool, has_emb: bool) -> float:
    raw = (
        _score_photos(photos) * _WEIGHTS["photos"]
        + _score_count(reviews) * _WEIGHTS["reviews"]
        + _score_count(tags) * _WEIGHTS["tags"]
        + (100 if has_desc else 0) * _WEIGHTS["description"]
        + (100 if has_emb else 0) * _WEIGHTS["embedding"]
    )
    return raw / sum(_WEIGHTS.values())


def _fetch_photo_counts(db, shop_ids: list[str]) -> dict[str, int]:
    rows = db.table("shop_photos").select("shop_id").in_("shop_id", shop_ids).execute()
    counts: dict[str, int] = {sid: 0 for sid in shop_ids}
    for r in rows.data:
        counts[r["shop_id"]] += 1
    return counts


def _fetch_review_data(
    db, shop_ids: list[str]
) -> tuple[dict[str, int], dict[str, list[int]], dict[str, dict[str, int]]]:
    rows = db.table("shop_reviews").select("shop_id,text").in_("shop_id", shop_ids).execute()
    counts: dict[str, int] = {sid: 0 for sid in shop_ids}
    lengths: dict[str, list[int]] = {sid: [] for sid in shop_ids}
    lang_counts: dict[str, dict[str, int]] = {sid: {} for sid in shop_ids}

    for r in rows.data:
        sid = r["shop_id"]
        counts[sid] += 1
        text = r.get("text") or ""
        lengths[sid].append(len(text))
        lang = _detect_lang(text)
        lang_counts[sid][lang] = lang_counts[sid].get(lang, 0) + 1

    return counts, lengths, lang_counts


def _detect_lang(text: str) -> str:
    cjk = sum(1 for c in text if "\u4e00" <= c <= "\u9fff")
    return "zh" if cjk > len(text) * 0.1 else "en"


def _fetch_tag_counts(db, shop_ids: list[str]) -> dict[str, int]:
    rows = db.table("shop_tags").select("shop_id").in_("shop_id", shop_ids).execute()
    counts: dict[str, int] = {sid: 0 for sid in shop_ids}
    for r in rows.data:
        counts[r["shop_id"]] += 1
    return counts


def _pct(n: int, total: int) -> float:
    return round(100.0 * n / total, 1) if total else 0.0


def _avg(values: list[float]) -> float:
    return round(sum(values) / len(values), 2) if values else 0.0


def _median(values: list[float]) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    n = len(s)
    return round((s[n // 2] + s[(n - 1) // 2]) / 2, 1)


def _percentile(values: list[float], p: float) -> float:
    if not values:
        return 0.0
    s = sorted(values)
    idx = int(len(s) * p / 100)
    return round(s[min(idx, len(s) - 1)], 1)


def _photo_bucket(n: int) -> str:
    if n == 0:
        return "0"
    if n <= 3:
        return "1-3"
    if n <= 10:
        return "4-10"
    return "10+"


def _score_bucket(s: float) -> str:
    if s <= 25:
        return "0-25"
    if s <= 50:
        return "26-50"
    if s <= 75:
        return "51-75"
    return "76-100"


async def main(output_dir: Path | None, json_only: bool) -> None:
    db = get_service_role_client()

    if not json_only:
        print("\n=== CafeRoam Coverage Audit ===\n")
        print("Fetching live shops…", end=" ", flush=True)

    shops = fetch_live_shops(db, "id,name,description,embedding,mode_work")
    total = len(shops)
    if total == 0:
        warn("No live shops found. Run the pipeline first.")
        sys.exit(1)

    shop_ids = [s["id"] for s in shops]

    photo_counts = _fetch_photo_counts(db, shop_ids)
    review_counts, review_lengths, lang_counts = _fetch_review_data(db, shop_ids)
    tag_counts = _fetch_tag_counts(db, shop_ids)

    if not json_only:
        print(f"done ({total} shops)\n")

    shop_scores: list[dict] = []
    for s in shops:
        sid = s["id"]
        pc = photo_counts.get(sid, 0)
        rc = review_counts.get(sid, 0)
        tc = tag_counts.get(sid, 0)
        has_desc = s.get("description") is not None
        has_emb = s.get("embedding") is not None
        score = _quality_score(pc, rc, tc, has_desc, has_emb)

        missing = []
        if pc == 0:
            missing.append("photos")
        if rc == 0:
            missing.append("reviews")
        if tc == 0:
            missing.append("tags")
        if not has_desc:
            missing.append("description")
        if not has_emb:
            missing.append("embedding")

        shop_scores.append(
            {
                "id": sid,
                "name": s.get("name", ""),
                "score": round(score, 1),
                "missing": missing,
                "photo_count": pc,
                "review_count": rc,
                "tag_count": tc,
            }
        )

    score_values = [s["score"] for s in shop_scores]

    photo_hist: dict[str, int] = {"0": 0, "1-3": 0, "4-10": 0, "10+": 0}
    for n in photo_counts.values():
        photo_hist[_photo_bucket(n)] += 1

    score_hist: dict[str, int] = {"0-25": 0, "26-50": 0, "51-75": 0, "76-100": 0}
    for sv in score_values:
        score_hist[_score_bucket(sv)] += 1

    agg_lang: dict[str, int] = {}
    for ld in lang_counts.values():
        for lang, cnt in ld.items():
            agg_lang[lang] = agg_lang.get(lang, 0) + cnt

    all_lengths = [length for ls in review_lengths.values() for length in ls]
    median_len = int(_median([float(length) for length in all_lengths]))

    shops_with_photos = sum(1 for n in photo_counts.values() if n > 0)
    shops_with_reviews = sum(1 for n in review_counts.values() if n > 0)
    shops_with_tags = sum(1 for n in tag_counts.values() if n > 0)
    shops_with_desc = sum(1 for s in shops if s.get("description") is not None)
    shops_with_emb = sum(1 for s in shops if s.get("embedding") is not None)
    shops_with_mode = sum(1 for s in shops if s.get("mode_work") is not None)

    thin_shops = sorted(
        [s for s in shop_scores if s["score"] < 50],
        key=lambda x: x["score"],
    )

    photos_pct = _pct(shops_with_photos, total)
    reviews_pct = _pct(shops_with_reviews, total)
    tags_pct = _pct(shops_with_tags, total)
    mean_quality = round(_avg(score_values), 1)

    def _check(metric: str, actual: float) -> dict:
        target = THRESHOLDS[metric]["target"]
        return {"target": target, "actual": actual, "pass": actual >= target}

    thresholds = {
        "photos_present": _check("photos_present", photos_pct),
        "reviews_present": _check("reviews_present", reviews_pct),
        "tags_present": _check("tags_present", tags_pct),
        "mean_quality": _check("mean_quality", mean_quality),
    }

    desc_pct = _pct(shops_with_desc, total)
    emb_pct = _pct(shops_with_emb, total)
    mode_pct = _pct(shops_with_mode, total)

    result = {
        "run_date": date.today().isoformat(),
        "total_live_shops": total,
        "coverage": {
            "photos": {
                "present_pct": photos_pct,
                "avg_per_shop": _avg([float(n) for n in photo_counts.values()]),
                "histogram": photo_hist,
            },
            "reviews": {
                "present_pct": reviews_pct,
                "avg_per_shop": _avg([float(n) for n in review_counts.values()]),
                "median_length": median_len,
                "language": agg_lang,
            },
            "tags": {
                "present_pct": tags_pct,
                "avg_per_shop": _avg([float(n) for n in tag_counts.values()]),
            },
            "description": {"present_pct": desc_pct},
            "embedding": {"present_pct": emb_pct},
            "mode_scores": {"present_pct": mode_pct},
        },
        "quality_scores": {
            "mean": mean_quality,
            "median": _median(score_values),
            "p10": _percentile(score_values, 10),
            "histogram": score_hist,
        },
        "thin_shops": [
            {"id": s["id"], "name": s["name"], "score": s["score"], "missing": s["missing"]}
            for s in thin_shops
        ],
        "thresholds": thresholds,
    }

    path = save_results(result, "run_coverage_audit", output_dir)

    if json_only:
        print(str(path))
        return

    print("Coverage")
    cov = result["coverage"]

    def _avg_str(dim: str) -> str:
        return f"avg {cov[dim]['avg_per_shop']}/shop"

    print_table(
        [
            ["Photos", f"{cov['photos']['present_pct']}%", _avg_str("photos")],
            ["Reviews", f"{cov['reviews']['present_pct']}%", _avg_str("reviews")],
            ["Tags", f"{cov['tags']['present_pct']}%", _avg_str("tags")],
            ["Description", f"{cov['description']['present_pct']}%", ""],
            ["Embedding", f"{cov['embedding']['present_pct']}%", ""],
            ["Mode scores", f"{cov['mode_scores']['present_pct']}%", ""],
        ],
        ["Dimension", "Present %", "Detail"],
    )

    print()
    print("Quality Score Distribution")
    qs = result["quality_scores"]
    print(f"  mean={qs['mean']}  median={qs['median']}  p10={qs['p10']}")
    print(f"  histogram: {qs['histogram']}")

    if thin_shops:
        print(f"\nThin shops (score < 50): {len(thin_shops)}")
        for s in thin_shops[:10]:
            missing_str = ", ".join(s["missing"]) if s["missing"] else "—"
            print(f"  {s['score']:>5.1f}  {s['name'][:40]}  missing: {missing_str}")
        if len(thin_shops) > 10:
            print(f"  … and {len(thin_shops) - 10} more (see JSON)")

    print()
    print("Thresholds")
    for name, t in thresholds.items():
        print_threshold(name, t["target"], t["actual"], t["pass"])

    all_pass = all(t["pass"] for t in thresholds.values())
    status = "\033[32mPASS\033[0m" if all_pass else "\033[31mFAIL\033[0m"
    print(f"\n  Overall: {status}")
    print(f"\n  Output: {path}\n")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Data completeness audit for live shops")
    parser.add_argument(
        "--output-dir", type=Path, default=None, help="Override default eval_outputs path"
    )
    parser.add_argument(
        "--json-only", action="store_true", help="Suppress console output, print JSON path only"
    )
    args = parser.parse_args()
    asyncio.run(main(output_dir=args.output_dir, json_only=args.json_only))
