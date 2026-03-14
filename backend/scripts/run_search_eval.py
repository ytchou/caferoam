"""Search relevance evaluation using LLM-as-judge.

Costs: ~$0.001 embeddings + ~$0.15-0.20 Claude judge calls.

Note: This script evaluates embedding retrieval quality via the search_shops RPC.
The production SearchService also applies a taxonomy boost (0.7*similarity + 0.3*boost)
when dimension filters are active. The standard query set does not use dimension filters,
so ranking order is equivalent to production for these queries. If dimension-filtered
queries are added, switch to using SearchService directly to capture the full reranking.

Usage (run from backend/):
    uv run python scripts/run_search_eval.py \
        [--queries-file PATH] [--match-count 5] [--output-dir PATH] [--json-only]
"""

from __future__ import annotations

import asyncio
import json
import math
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

import anthropic

from core.config import settings
from db.supabase_client import get_service_role_client
from providers.embeddings import get_embeddings_provider
from scripts.eval_utils import (
    print_table,
    print_threshold,
    save_results,
    warn,
)

THRESHOLDS = {
    "pass_rate": {"target": 70.0},
    "mean_ndcg5": {"target": 0.6},
}

_DEFAULT_QUERIES_FILE = (
    Path(__file__).parent.parent.parent
    / "scripts"
    / "prebuild"
    / "data-pipeline"
    / "search-queries.json"
)


def _dcg(scores: list[float]) -> float:
    return sum(s / math.log2(i + 2) for i, s in enumerate(scores))


def _ndcg(scores: list[float]) -> float:
    ideal = sorted(scores, reverse=True)
    idcg = _dcg(ideal)
    return round(_dcg(scores) / idcg, 4) if idcg > 0 else 0.0


def _mrr(scores: list[float]) -> float:
    for i, s in enumerate(scores):
        if s >= 1:
            return round(1.0 / (i + 1), 4)
    return 0.0


def _search(db, embedding: list[float], match_count: int) -> list[dict]:
    response = db.rpc(
        "search_shops",
        {
            "query_embedding": embedding,
            "match_count": match_count,
        },
    ).execute()
    return response.data or []


def _load_shop_details(db, shop_ids: list[str]) -> dict[str, dict]:
    if not shop_ids:
        return {}
    shops = db.table("shops").select("id,name,description").in_("id", shop_ids).execute().data
    photos = db.table("shop_photos").select("shop_id").in_("shop_id", shop_ids).execute().data
    tags_raw = (
        db.table("shop_tags").select("shop_id,tag_id").in_("shop_id", shop_ids).execute().data
    )
    tag_ids = list({r["tag_id"] for r in tags_raw})
    tag_labels: dict[str, str] = {}
    if tag_ids:
        tag_rows = db.table("taxonomy_tags").select("id,label").in_("id", tag_ids).execute().data
        tag_labels = {t["id"]: t.get("label", t["id"]) for t in tag_rows}

    photo_count: dict[str, int] = {}
    for p in photos:
        photo_count[p["shop_id"]] = photo_count.get(p["shop_id"], 0) + 1

    tags_by_shop: dict[str, list[str]] = {}
    for r in tags_raw:
        label = tag_labels.get(r["tag_id"], r["tag_id"])
        tags_by_shop.setdefault(r["shop_id"], []).append(label)

    reviews = db.table("shop_reviews").select("shop_id").in_("shop_id", shop_ids).execute().data
    review_count: dict[str, int] = {}
    for rv in reviews:
        review_count[rv["shop_id"]] = review_count.get(rv["shop_id"], 0) + 1

    result = {}
    for s in shops:
        sid = s["id"]
        result[sid] = {
            "name": s.get("name", ""),
            "description": (s.get("description") or "")[:200],
            "tags": tags_by_shop.get(sid, []),
            "photo_count": photo_count.get(sid, 0),
            "review_count": review_count.get(sid, 0),
        }
    return result


_JUDGE_SYSTEM = """You are a search quality evaluator for a Taiwanese coffee shop directory.
Rate each search result's relevance to the query on a scale of 0-2:
  0 = irrelevant (no relationship to query intent)
  1 = partially relevant (some match but not ideal)
  2 = highly relevant (strong match to query intent)

Consider: query intent, shop description, tags, and overall fit.
Return ONLY valid JSON in this exact format (no markdown, no explanation):
{"ratings": [{"rank": 1, "score": 2, "reason": "..."}, ...]}"""


def _build_judge_prompt(query: str, expected_traits: list[str], results: list[dict]) -> str:
    lines = [
        f'Query: "{query}"',
        f"Expected traits: {', '.join(expected_traits)}",
        "",
    ]
    for i, r in enumerate(results, 1):
        desc = r["description"][:150] if r["description"] else "(no description)"
        tags = ", ".join(r["tags"][:8]) if r["tags"] else "(no tags)"
        lines.append(
            f"Result {i}: {r['name']} — {desc} — Tags: {tags}"
            f" — {r['photo_count']} photos, {r['review_count']} reviews"
        )
    return "\n".join(lines)


async def _judge(client: anthropic.AsyncAnthropic, prompt: str, n_results: int) -> list[dict]:
    msg = await client.messages.create(
        model=settings.anthropic_model,
        max_tokens=512,
        system=_JUDGE_SYSTEM,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text.strip()
    try:
        parsed = json.loads(text)
        ratings = parsed.get("ratings", [])
        if len(ratings) < n_results:
            ratings.extend(
                {"rank": i + 1, "score": 0, "reason": "missing"}
                for i in range(len(ratings), n_results)
            )
        return ratings[:n_results]
    except (json.JSONDecodeError, KeyError):
        warn(f"Failed to parse judge response: {text[:200]}")
        return [{"rank": i + 1, "score": 0, "reason": "parse_error"} for i in range(n_results)]


async def main(
    queries_file: Path, match_count: int, output_dir: Path | None, json_only: bool
) -> None:
    if not queries_file.exists():
        warn(f"Queries file not found: {queries_file}")
        sys.exit(1)

    queries = json.loads(queries_file.read_text())

    db = get_service_role_client()
    embeddings = get_embeddings_provider()
    client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)

    if not json_only:
        print(f"\n=== CafeRoam Search Eval  ({len(queries)} queries, top-{match_count}) ===\n")

    query_results: list[dict] = []

    for q in queries:
        qid = q["id"]
        query_text = q["query"]
        category = q.get("category", "")
        expected_traits = q.get("expectedTraits", [])

        if not json_only:
            print(f"  [{qid}] {query_text[:60]}", end=" ... ", flush=True)

        try:
            embedding = await embeddings.embed(query_text)
        except Exception as exc:
            warn(f"Embedding failed for {qid}: {exc}")
            query_results.append(
                {
                    "id": qid,
                    "query": query_text,
                    "category": category,
                    "expected_traits": expected_traits,
                    "results": [],
                    "ndcg5": 0.0,
                    "mrr": 0.0,
                    "top1_relevant": False,
                    "error": str(exc),
                }
            )
            if not json_only:
                print("EMBED ERROR")
            continue

        raw_results = _search(db, embedding, match_count)
        shop_ids = [r["id"] for r in raw_results]
        details = _load_shop_details(db, shop_ids)

        enriched_results = []
        for rank, r in enumerate(raw_results, 1):
            sid = r["id"]
            d = details.get(sid, {})
            similarity = round(float(r.get("similarity", 0)), 4)
            enriched_results.append(
                {
                    "rank": rank,
                    "shop_id": sid,
                    "name": d.get("name", r.get("name", "")),
                    "description": d.get("description", ""),
                    "tags": d.get("tags", []),
                    "photo_count": d.get("photo_count", 0),
                    "review_count": d.get("review_count", 0),
                    "similarity": similarity,
                    "total_score": similarity,
                }
            )

        if not enriched_results:
            warn(f"No results for query {qid}")
            query_results.append(
                {
                    "id": qid,
                    "query": query_text,
                    "category": category,
                    "expected_traits": expected_traits,
                    "results": [],
                    "ndcg5": 0.0,
                    "mrr": 0.0,
                    "top1_relevant": False,
                }
            )
            continue

        prompt = _build_judge_prompt(query_text, expected_traits, enriched_results)
        ratings = await _judge(client, prompt, len(enriched_results))

        ratings_by_rank = {r["rank"]: r for r in ratings}
        judge_scores = []
        for i, res in enumerate(enriched_results):
            rating = ratings_by_rank.get(i + 1, {"score": 0, "reason": ""})
            raw_score = rating.get("score", 0)
            res["judge_score"] = max(0, min(2, int(raw_score)))
            res["reason"] = rating.get("reason", "")
            judge_scores.append(float(res["judge_score"]))

        ndcg5 = _ndcg(judge_scores)
        mrr = _mrr(judge_scores)
        top1_relevant = judge_scores[0] >= 1 if judge_scores else False

        if not json_only:
            scores_str = " ".join(str(int(s)) for s in judge_scores)
            print(f"NDCG={ndcg5:.2f}  MRR={mrr:.2f}  [{scores_str}]")

        query_results.append(
            {
                "id": qid,
                "query": query_text,
                "category": category,
                "expected_traits": expected_traits,
                "results": enriched_results,
                "ndcg5": ndcg5,
                "mrr": mrr,
                "top1_relevant": top1_relevant,
            }
        )

    ndcg_values = [q["ndcg5"] for q in query_results]
    mrr_values = [q["mrr"] for q in query_results]
    top1_values = [q["top1_relevant"] for q in query_results]

    mean_ndcg5 = round(sum(ndcg_values) / len(ndcg_values), 4) if ndcg_values else 0.0
    mean_mrr = round(sum(mrr_values) / len(mrr_values), 4) if mrr_values else 0.0
    pass_rate = round(100.0 * sum(top1_values) / len(top1_values), 1) if top1_values else 0.0

    categories: dict[str, list[float]] = {}
    for q in query_results:
        cat = q["category"]
        categories.setdefault(cat, []).append(q["ndcg5"])
    by_category = {
        cat: {"mean_ndcg5": round(sum(v) / len(v), 4), "count": len(v)}
        for cat, v in categories.items()
    }

    thresholds = {
        "pass_rate": {
            "target": THRESHOLDS["pass_rate"]["target"],
            "actual": pass_rate,
            "pass": pass_rate >= THRESHOLDS["pass_rate"]["target"],
        },
        "mean_ndcg5": {
            "target": THRESHOLDS["mean_ndcg5"]["target"],
            "actual": mean_ndcg5,
            "pass": mean_ndcg5 >= THRESHOLDS["mean_ndcg5"]["target"],
        },
    }

    result = {
        "run_date": date.today().isoformat(),
        "model": settings.anthropic_model,
        "embedding_model": settings.openai_embedding_model,
        "queries": query_results,
        "aggregate": {
            "mean_ndcg5": mean_ndcg5,
            "mean_mrr": mean_mrr,
            "pass_rate": pass_rate,
            "by_category": by_category,
        },
        "thresholds": thresholds,
    }

    path = save_results(result, "run_search_eval", output_dir)

    if json_only:
        print(str(path))
        return

    print()
    print("Aggregate Results")
    print_table(
        [
            ["mean_ndcg5", f"{mean_ndcg5:.4f}"],
            ["mean_mrr", f"{mean_mrr:.4f}"],
            ["pass_rate", f"{pass_rate:.1f}%"],
        ],
        ["Metric", "Value"],
    )

    print()
    print("By Category")
    print_table(
        [[cat, f"{v['mean_ndcg5']:.4f}", v["count"]] for cat, v in by_category.items()],
        ["Category", "Mean NDCG@5", "Count"],
    )

    print()
    print("Per-Query Summary")
    print_table(
        [
            [
                q["id"],
                q["query"][:35],
                f"{q['ndcg5']:.2f}",
                f"{q['mrr']:.2f}",
                "Y" if q["top1_relevant"] else "N",
            ]
            for q in query_results
        ],
        ["ID", "Query", "NDCG@5", "MRR", "Top1 OK"],
    )

    print()
    print("Thresholds")
    print_threshold(
        "pass_rate (%)",
        THRESHOLDS["pass_rate"]["target"],
        pass_rate,
        thresholds["pass_rate"]["pass"],
    )
    print_threshold(
        "mean_ndcg5",
        THRESHOLDS["mean_ndcg5"]["target"],
        mean_ndcg5,
        thresholds["mean_ndcg5"]["pass"],
    )

    all_pass = all(t["pass"] for t in thresholds.values())
    status = "\033[32mPASS\033[0m" if all_pass else "\033[31mFAIL\033[0m"
    print(f"\n  Overall: {status}")
    print(f"\n  Output: {path}\n")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Search relevance evaluation using LLM judge")
    parser.add_argument(
        "--queries-file",
        type=Path,
        default=_DEFAULT_QUERIES_FILE,
        help="Path to search queries JSON",
    )
    parser.add_argument("--match-count", type=int, default=5, help="Top-N results per query")
    parser.add_argument(
        "--output-dir", type=Path, default=None, help="Override default eval_outputs path"
    )
    parser.add_argument(
        "--json-only", action="store_true", help="Suppress console output, print JSON path only"
    )
    args = parser.parse_args()
    asyncio.run(
        main(
            queries_file=args.queries_file,
            match_count=args.match_count,
            output_dir=args.output_dir,
            json_only=args.json_only,
        )
    )
