# Code Review Log: feat/eval-scripts

**Date:** 2026-03-14
**Branch:** feat/eval-scripts
**Mode:** Post-PR (#33)

## Pass 1 — Full Discovery

_Agents: Bug Hunter (Opus), Standards (Sonnet), Architecture (Opus), Plan Alignment (Sonnet)_

### Issues Found (14 total, after dedup)

| Severity  | File:Line                                          | Description                                                                                    | Flagged By                   |
| --------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------- |
| Important | run_search_eval.py:192                             | Unhandled exception from `embeddings.embed()` kills entire eval run, losing partial results    | Bug Hunter                   |
| Important | run_search_eval.py:151-159                         | `_judge` doesn't validate score values are in 0-2 range; corrupts NDCG/MRR                     | Bug Hunter                   |
| Important | run_search_eval.py:64-73                           | Eval bypasses taxonomy boost — evaluates degraded version of production search                 | Architecture, Plan Alignment |
| Important | run_tag_audit.py:54                                | `_fetch_shop_tags` fetches ALL shop_tags with no live-shops filter; skews tag frequency report | Bug Hunter, Standards        |
| Important | run_coverage_audit.py:68 / run_tag_audit.py:39     | `_fetch_live_shops` duplicated across two scripts with different column lists                  | Architecture                 |
| Minor     | eval_utils.py:68                                   | `warn()` uses Unicode ⚠ emoji; violates CLAUDE.md "no emojis in code"                          | Standards                    |
| Minor     | run_tag_audit.py:53-54                             | `shop_tags` iterated 4 separate times; minor inefficiency                                      | Architecture                 |
| Minor     | run_tag_audit.py:209                               | Substring grounding match can false-positive on short labels ("tea" in "theater")              | Architecture                 |
| Minor     | run_search_eval.py:38-44                           | `_DEFAULT_QUERIES_FILE` path depends on relative directory structure                           | Bug Hunter, Plan Alignment   |
| Minor     | run_coverage_audit.py:main / run_tag_audit.py:main | `async def main()` with no `await` — misleading but not harmful                                | Bug Hunter                   |
| Minor     | eval_utils.py:32-33                                | `save_results` non-atomic write (crash mid-write = corrupt JSON)                               | Bug Hunter                   |
| Minor     | TODO.md                                            | Phase 2B "Enrichment validation" items not marked done                                         | Plan Alignment               |

### Validation Results

_(Populated after Phase 5)_
