"""Taxonomy health audit for live shops.

SQL + Python string matching, $0 cost.

Usage (run from backend/):
    uv run python scripts/run_tag_audit.py [--sample-size 20] [--output-dir PATH] [--json-only]
"""

from __future__ import annotations

import asyncio
import random
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from db.supabase_client import get_service_role_client
from scripts.eval_utils import (
    print_table,
    print_threshold,
    save_results,
    warn,
)

# ── Thresholds ─────────────────────────────────────────────────────────────────

THRESHOLDS = {
    "no_tag_over_60pct": {"target": True},
    "all_dimensions_above_50pct": {"target": True},
    "mean_grounding_above_60pct": {"target": 60.0},
}

_OVER_REPRESENTED_PCT = 60.0
_RARE_PCT = 2.0
_DIMENSION_MIN_PCT = 50.0
_LOW_CONFIDENCE_MAX = 0.5

# ── Fetch helpers ──────────────────────────────────────────────────────────────


def _fetch_live_shops(db) -> list[dict]:
    return (
        db.table("shops")
        .select("id,name,description")
        .eq("processing_status", "live")
        .execute()
        .data
    )


def _fetch_taxonomy_tags(db) -> list[dict]:
    return db.table("taxonomy_tags").select("id,dimension,label,label_zh,aliases").execute().data


def _fetch_shop_tags(db) -> list[dict]:
    return db.table("shop_tags").select("shop_id,tag_id,confidence").execute().data


def _fetch_reviews_for_shops(db, shop_ids: list[str]) -> dict[str, list[str]]:
    rows = db.table("shop_reviews").select("shop_id,text").in_("shop_id", shop_ids).execute().data
    result: dict[str, list[str]] = {sid: [] for sid in shop_ids}
    for r in rows:
        if r.get("text"):
            result[r["shop_id"]].append(r["text"])
    return result


# ── Analysis ───────────────────────────────────────────────────────────────────


def _tag_frequency(shop_tags: list[dict], tag_map: dict[str, dict], total_shops: int) -> list[dict]:
    """Compute per-tag shop count, pct, avg confidence, and flag."""
    tag_shops: dict[str, set[str]] = {}
    tag_confidence_sum: dict[str, float] = {}
    tag_confidence_count: dict[str, int] = {}

    for st in shop_tags:
        tid = st["tag_id"]
        sid = st["shop_id"]
        conf = float(st.get("confidence") or 0.0)
        tag_shops.setdefault(tid, set()).add(sid)
        tag_confidence_sum[tid] = tag_confidence_sum.get(tid, 0.0) + conf
        tag_confidence_count[tid] = tag_confidence_count.get(tid, 0) + 1

    rows: list[dict] = []
    for tag in tag_map.values():
        tid = tag["id"]
        shops_with_tag = len(tag_shops.get(tid, set()))
        pct = round(100.0 * shops_with_tag / total_shops, 1) if total_shops else 0.0
        cnt = tag_confidence_count.get(tid, 0)
        avg_conf = round(tag_confidence_sum.get(tid, 0.0) / cnt, 3) if cnt else 0.0

        flag = None
        if pct > _OVER_REPRESENTED_PCT:
            flag = "over_represented"
        elif pct < _RARE_PCT and shops_with_tag > 0:
            flag = "rare"

        rows.append(
            {
                "id": tid,
                "dimension": tag.get("dimension", ""),
                "label": tag.get("label", ""),
                "label_zh": tag.get("label_zh", ""),
                "shop_count": shops_with_tag,
                "pct": pct,
                "avg_confidence": avg_conf,
                "flag": flag,
            }
        )

    return sorted(rows, key=lambda r: r["shop_count"], reverse=True)


def _dimension_coverage(
    shop_tags: list[dict],
    tag_map: dict[str, dict],
    live_shop_ids: set[str],
) -> dict[str, dict]:
    """For each dimension, % of live shops with at least one tag."""
    tag_dim: dict[str, str] = {t["id"]: t.get("dimension", "") for t in tag_map.values()}
    dim_shops: dict[str, set[str]] = {}

    for st in shop_tags:
        if st["shop_id"] not in live_shop_ids:
            continue
        dim = tag_dim.get(st["tag_id"], "")
        if dim:
            dim_shops.setdefault(dim, set()).add(st["shop_id"])

    total = len(live_shop_ids)
    dims = sorted({t.get("dimension", "") for t in tag_map.values()} - {""})
    result: dict[str, dict] = {}
    for dim in dims:
        cnt = len(dim_shops.get(dim, set()))
        result[dim] = {
            "shop_count": cnt,
            "pct": round(100.0 * cnt / total, 1) if total else 0.0,
        }
    return result


def _confidence_distribution(shop_tags: list[dict]) -> dict[str, int]:
    buckets = {"0.0-0.3": 0, "0.3-0.5": 0, "0.5-0.7": 0, "0.7-0.9": 0, "0.9-1.0": 0}
    for st in shop_tags:
        c = float(st.get("confidence") or 0.0)
        if c < 0.3:
            buckets["0.0-0.3"] += 1
        elif c < 0.5:
            buckets["0.3-0.5"] += 1
        elif c < 0.7:
            buckets["0.5-0.7"] += 1
        elif c < 0.9:
            buckets["0.7-0.9"] += 1
        else:
            buckets["0.9-1.0"] += 1
    return buckets


def _low_confidence_shops(
    shop_tags: list[dict],
    shop_map: dict[str, dict],
    threshold: float = _LOW_CONFIDENCE_MAX,
) -> list[dict]:
    """Shops where ALL assigned tags have confidence < threshold."""
    shop_max_conf: dict[str, float] = {}
    for st in shop_tags:
        sid = st["shop_id"]
        c = float(st.get("confidence") or 0.0)
        shop_max_conf[sid] = max(shop_max_conf.get(sid, 0.0), c)

    result = []
    for sid, max_c in shop_max_conf.items():
        if max_c < threshold and sid in shop_map:
            result.append(
                {
                    "id": sid,
                    "name": shop_map[sid].get("name", ""),
                    "max_confidence": round(max_c, 3),
                }
            )
    return sorted(result, key=lambda x: x["max_confidence"])


def _text_grounding(
    sample_shops: list[dict],
    shop_tags_by_shop: dict[str, list[dict]],
    tag_map: dict[str, dict],
    reviews_by_shop: dict[str, list[str]],
) -> dict:
    """For each sample shop, check how many tags are grounded in text."""
    per_shop = []

    for shop in sample_shops:
        sid = shop["id"]
        texts = reviews_by_shop.get(sid, [])
        desc = shop.get("description") or ""
        combined = " ".join(texts + [desc]).lower()

        tags = shop_tags_by_shop.get(sid, [])
        grounded = 0
        ungrounded: list[str] = []

        for st in tags:
            tid = st["tag_id"]
            tag = tag_map.get(tid)
            if not tag:
                continue

            candidates = [
                (tag.get("label") or "").lower(),
                (tag.get("label_zh") or "").lower(),
            ]
            aliases = tag.get("aliases") or []
            if isinstance(aliases, list):
                candidates.extend(a.lower() for a in aliases if a)

            found = any(c and c in combined for c in candidates)
            if found:
                grounded += 1
            else:
                ungrounded.append(tag.get("label") or tid)

        total_tags = len(tags)
        rate = round(grounded / total_tags, 3) if total_tags else 0.0

        per_shop.append(
            {
                "id": sid,
                "name": shop.get("name", ""),
                "total_tags": total_tags,
                "grounded": grounded,
                "grounding_rate": rate,
                "ungrounded_tags": ungrounded,
            }
        )

    rates = [s["grounding_rate"] for s in per_shop]
    mean_rate = round(sum(rates) / len(rates), 3) if rates else 0.0

    return {
        "sample_size": len(sample_shops),
        "mean_grounding_rate": mean_rate,
        "per_shop": per_shop,
    }


# ── Main ───────────────────────────────────────────────────────────────────────


async def main(sample_size: int, output_dir: Path | None, json_only: bool) -> None:
    from datetime import date

    db = get_service_role_client()

    if not json_only:
        print("\n=== CafeRoam Tag Audit ===\n")
        print("Fetching data…", end=" ", flush=True)

    shops = _fetch_live_shops(db)
    total = len(shops)
    if total == 0:
        warn("No live shops found.")
        sys.exit(1)

    shop_map = {s["id"]: s for s in shops}
    live_shop_ids = set(shop_map.keys())

    taxonomy_tags = _fetch_taxonomy_tags(db)
    tag_map = {t["id"]: t for t in taxonomy_tags}

    shop_tags = _fetch_shop_tags(db)

    if not json_only:
        print(f"done ({total} shops, {len(taxonomy_tags)} tags, {len(shop_tags)} assignments)\n")

    # A. Tag frequency
    freq = _tag_frequency(shop_tags, tag_map, total)

    # B. Dimension coverage
    dim_coverage = _dimension_coverage(shop_tags, tag_map, live_shop_ids)

    # C. Confidence distribution
    conf_dist = _confidence_distribution(shop_tags)
    low_conf_shops = _low_confidence_shops(shop_tags, shop_map)

    # D. Text grounding on sample
    n_sample = min(sample_size, total)
    sample_ids = random.sample(list(live_shop_ids), n_sample)
    sample_shops = [shop_map[sid] for sid in sample_ids]

    if not json_only:
        print(f"Running text grounding check on {n_sample} shops…", end=" ", flush=True)

    reviews_by_shop = _fetch_reviews_for_shops(db, sample_ids)
    shop_tags_by_shop: dict[str, list[dict]] = {}
    for st in shop_tags:
        if st["shop_id"] in set(sample_ids):
            shop_tags_by_shop.setdefault(st["shop_id"], []).append(st)

    grounding = _text_grounding(sample_shops, shop_tags_by_shop, tag_map, reviews_by_shop)

    if not json_only:
        print("done\n")

    # Thresholds
    over_represented = [r["id"] for r in freq if r["flag"] == "over_represented"]
    all_dims_above_50 = all(v["pct"] >= _DIMENSION_MIN_PCT for v in dim_coverage.values())
    mean_grounding_pct = round(grounding["mean_grounding_rate"] * 100, 1)

    thresholds = {
        "no_tag_over_60pct": {
            "target": True,
            "actual": len(over_represented) == 0,
            "offenders": over_represented,
            "pass": len(over_represented) == 0,
        },
        "all_dimensions_above_50pct": {
            "target": True,
            "actual": all_dims_above_50,
            "pass": all_dims_above_50,
        },
        "mean_grounding_above_60pct": {
            "target": 60.0,
            "actual": mean_grounding_pct,
            "pass": mean_grounding_pct >= 60.0,
        },
    }

    result = {
        "run_date": date.today().isoformat(),
        "total_live_shops": total,
        "tag_frequency": freq,
        "dimension_coverage": dim_coverage,
        "confidence_distribution": conf_dist,
        "low_confidence_shops": low_conf_shops,
        "text_grounding": grounding,
        "thresholds": thresholds,
    }

    path = save_results(result, "run_tag_audit", output_dir)

    if json_only:
        print(str(path))
        return

    # Console output
    print("Tag Frequency (top 15 + flagged)")
    flagged = [r for r in freq if r["flag"]]
    top15 = freq[:15]
    display = {r["id"]: r for r in top15}
    for r in flagged:
        display[r["id"]] = r

    print_table(
        [
            [
                r["id"][:30],
                r["dimension"],
                r["shop_count"],
                f"{r['pct']}%",
                f"{r['avg_confidence']:.3f}",
                r["flag"] or "",
            ]
            for r in sorted(display.values(), key=lambda x: x["shop_count"], reverse=True)
        ],
        ["Tag ID", "Dimension", "Shops", "Pct", "Avg Conf", "Flag"],
    )

    print()
    print("Dimension Coverage")
    print_table(
        [[dim, f"{v['pct']}%", v["shop_count"]] for dim, v in dim_coverage.items()],
        ["Dimension", "Coverage %", "Shop Count"],
    )

    print()
    print("Confidence Distribution")
    print(f"  {conf_dist}")
    if low_conf_shops:
        print(f"\n  Low-confidence shops (all tags < {_LOW_CONFIDENCE_MAX}): {len(low_conf_shops)}")
        for s in low_conf_shops[:5]:
            print(f"    {s['name'][:40]}  max_conf={s['max_confidence']}")

    print()
    print(f"Text Grounding  (sample={grounding['sample_size']})")
    print(f"  Mean grounding rate: {mean_grounding_pct:.1f}%")
    worst = sorted(grounding["per_shop"], key=lambda x: x["grounding_rate"])[:5]
    for s in worst:
        rate_pct = round(s["grounding_rate"] * 100, 1)
        ungrounded = ", ".join(s["ungrounded_tags"][:3])
        print(f"  {rate_pct:>5.1f}%  {s['name'][:35]}  ungrounded: {ungrounded}")

    print()
    print("Thresholds")
    print_threshold(
        "no_tag_over_60pct",
        True,
        len(over_represented) == 0,
        thresholds["no_tag_over_60pct"]["pass"],
    )
    if over_represented:
        print(f"          offenders: {', '.join(over_represented)}")
    print_threshold(
        "all_dimensions_above_50pct",
        True,
        all_dims_above_50,
        thresholds["all_dimensions_above_50pct"]["pass"],
    )
    print_threshold(
        "mean_grounding_above_60pct",
        60.0,
        mean_grounding_pct,
        thresholds["mean_grounding_above_60pct"]["pass"],
    )

    all_pass = all(t["pass"] for t in thresholds.values())
    status = "\033[32mPASS\033[0m" if all_pass else "\033[31mFAIL\033[0m"
    print(f"\n  Overall: {status}")
    print(f"\n  Output: {path}\n")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Taxonomy health audit for live shops")
    parser.add_argument(
        "--sample-size", type=int, default=20, help="Number of shops for text grounding check"
    )
    parser.add_argument(
        "--output-dir", type=Path, default=None, help="Override default eval_outputs path"
    )
    parser.add_argument(
        "--json-only", action="store_true", help="Suppress console output, print JSON path only"
    )
    args = parser.parse_args()
    asyncio.run(
        main(
            sample_size=args.sample_size,
            output_dir=args.output_dir,
            json_only=args.json_only,
        )
    )
