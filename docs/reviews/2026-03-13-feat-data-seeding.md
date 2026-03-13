# Code Review Log: feat/data-seeding

**Date:** 2026-03-13
**Branch:** feat/data-seeding
**Mode:** Pre-PR

## Pass 1 — Full Discovery

_Agents: Bug Hunter (Opus), Standards (Sonnet), Architecture (Opus), Plan Alignment (Sonnet)_

### Issues Found (10 total after dedup + false positive removal)

| Severity  | File:Line                | Description                                                                                           | Flagged By             |
| --------- | ------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------- |
| Critical  | scheduler.py:168         | `create_task` without reference storage — tasks can be GC'd by CPython                                | Architecture           |
| Important | scheduler.py:49-66       | Provider abstraction violation: anthropic/openai SDK types imported directly in scheduler             | Standards              |
| Important | scheduler.py:129-146     | `CancelledError` not caught — cancelled tasks leave jobs permanently in `claimed` state               | Bug Hunter             |
| Important | config.py:59-70          | `Settings.get_worker_concurrency()` imports domain `JobType` — config layer couples to domain         | Architecture           |
| Important | run_url_import.py:83-133 | N+1 pattern: per-URL SELECT+INSERT in loop violates CLAUDE.md performance standards                   | Architecture           |
| Important | config.py:61             | `ENRICH_MENU_PHOTO` grouped with `ENRICH_SHOP` at concurrency=5; plan specifies default=1             | Plan Alignment         |
| Important | test_queue.py            | No test for `claim_batch()` — new central concurrency mechanism has zero test coverage                | Plan Alignment         |
| Minor     | run_url_import.py:48     | `re.match(r"^ChIJ", name)` — uncompiled regex in call path; CLAUDE.md requires module-level compile   | Standards              |
| Minor     | scheduler.py:130-131     | `get_service_role_client()` and `JobQueue()` execute before `try` block — counter leaks if they throw | Standards/Architecture |
| Minor     | apify_adapter.py         | Dict comprehension silently drops duplicate URLs (last-write-wins); no log warning                    | Standards              |

### False Positives Skipped

- `queue.py:79-80` Bug Hunter "Critical" off-by-one retry — Analysis was wrong. Tracing: claim1→attempts=1→retry, claim2→attempts=2→retry, claim3→attempts=3→FAILED = exactly 3 attempts for max_attempts=3. Correct behavior.
- Sync DB call blocking event loop — Pre-existing pattern throughout entire codebase (all `JobQueue` methods use sync supabase client in async context). Not introduced by this PR.
- "New DB client per job" proliferation — `get_service_role_client()` is `@lru_cache(maxsize=1)`, returns singleton. Non-issue.

### Out of Scope (Needs User Decision)

- `run_takeout_import.py` not implemented — TODO.md calls for GeoJSON Takeout import; branch shipped CSV+URL importers instead. Intentional pivot or gap? Surfaced to user.

### Validation Results

All 10 issues verified as valid or debatable. Proceeding to fix all.

---

## Fix Pass 1

**Pre-fix SHA:** 16dbe1803e275bbfadb13040bab673992b8b8ada

**Issues fixed:**

- [Critical] `scheduler.py:168` — Added `_tasks` set; `create_task` now stores reference + `add_done_callback(_tasks.discard)`
- [Important] `scheduler.py:49-66` — Removed anthropic/openai SDK imports; replaced with `type(e).__name__` + `type(e).__module__` inspection
- [Important] `scheduler.py:129-146` — Added `asyncio.CancelledError` handler; calls `queue.fail()` then re-raises
- [Important] `scheduler.py:130-131` — Moved `db`/`queue` init inside `try` block; guarded `queue.fail()` calls with `queue is not None`
- [Important] `config.py:59-70` — Removed `get_worker_concurrency()` from `Settings`; moved to `_get_job_concurrency()` in scheduler (no more config→domain coupling)
- [Important] `config.py:61` — `ENRICH_MENU_PHOTO` now falls to `worker_concurrency_default=1` per plan spec (was incorrectly grouped with ENRICH_SHOP at 5)
- [Important] `run_url_import.py:83-133` — Replaced per-URL SELECT+INSERT loop with batch validate → single `IN()` query → single bulk INSERT
- [Important] `test_queue.py` — Added `test_claim_batch_returns_jobs_up_to_limit` and `test_claim_batch_returns_empty_when_no_jobs`
- [Minor] `run_url_import.py:48` — Added `_PLACE_ID_RE = re.compile(r"^ChIJ")` at module level
- [Minor] `apify_adapter.py` — Added `logger.warning()` on duplicate URL with kept/dropped shop IDs

**Batch Test Run:**

- `pytest` — PASS (345 tests)

**Post-fix SHA:** c139d36

---

## Pass 2 — Re-Verify

_Agents re-run (smart routing): Bug Hunter, Architecture, Standards, Plan Alignment_

### Previously Flagged Issues — Resolution Status

All 9 fixable issues: resolved.

`run_takeout_import.py` not implemented — scope decision, surfaced to user.

### New Issues from Re-Verify

- Minor regression: bulk insert error message lost per-shop names → fixed in follow-up commit (c139d36)
- `ENRICH_MENU_PHOTO` at `worker_concurrency_default=1` flagged as "implicit" — intentional; correct per plan spec, not a regression

---

## Final State

**Iterations completed:** 1
**All Critical/Important resolved:** Yes
**Remaining issues:**

- None blocking

**Scope decision for user:** `run_takeout_import.py` — TODO.md planned a GeoJSON Takeout importer; branch ships CSV+URL importers instead. Confirm whether this is an intentional pivot or a gap to fill.

**Review log:** `docs/reviews/2026-03-13-feat-data-seeding.md`
