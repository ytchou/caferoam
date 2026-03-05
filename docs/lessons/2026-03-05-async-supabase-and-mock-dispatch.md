# Async Supabase SDK patterns and mock dispatch with asyncio.gather

**Date:** 2026-03-05
**Context:** User profile feature — profile_service.py review and fix

## What happened

Three related issues found together during code review of the async profile service:

1. `update_profile` called the supabase-py SDK directly in `async def`, blocking uvicorn's event loop.
2. `get_profile` used `.single()` which raises `APIError` when no profile row exists (new users), leaking a 500.
3. After parallelising with `asyncio.gather + asyncio.to_thread`, unit test mocks broke because they used `side_effect = [table_a, table_b, table_c]` — a list assumes a fixed call order, but gather makes order non-deterministic.

## Root cause

- supabase-py is synchronous. Using it in `async def` without `asyncio.to_thread` blocks the event loop.
- PostgREST `.single()` semantics: raises if 0 or 2+ rows match. `.limit(1)` returns a list safely.
- `asyncio.gather` dispatches coroutines concurrently; thread execution order is undefined. List-based side effects assume order.

## Prevention

1. **Always use `asyncio.to_thread`** when calling supabase-py SDK methods inside `async def`:

   ```python
   result = await asyncio.to_thread(lambda: db.table("x").select("*").execute())
   ```

2. **Never use `.single()` for optional rows** (profile, preferences, etc.):

   ```python
   # BAD — raises APIError if row missing
   resp = db.table("profiles").select("*").eq("id", uid).single().execute()

   # GOOD — returns empty list safely
   rows = db.table("profiles").select("*").eq("id", uid).limit(1).execute().data
   profile = rows[0] if rows else {}
   ```

3. **Mock by table name, not by call order**, when using `asyncio.gather`:

   ```python
   # BAD — order-dependent, breaks with gather
   mock_db.table.side_effect = [profile_table, stamp_table, checkin_table]

   # GOOD — dispatch by name, order-independent
   table_map = {"profiles": profile_table, "stamps": stamp_table, "check_ins": checkin_table}
   mock_db.table.side_effect = lambda name: table_map[name]
   ```
