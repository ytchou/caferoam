# PostgreSQL RPC Gotchas: Return Type Changes + PostgREST Row Limits

**Date:** 2026-03-02
**Context:** Pass 3 code review of feat/admin-dashboard

## 1. PostgreSQL Forbids Changing Return Type via CREATE OR REPLACE

**What happened:** Migration `20260302000002` added `avg_confidence` and `dimension` columns to `shop_tag_counts()` via `CREATE OR REPLACE FUNCTION`. PostgreSQL raises `ERROR: cannot change return type of existing function` at migration time, blocking deployment.

**Root cause:** `CREATE OR REPLACE FUNCTION` can only modify the function body — not its signature (argument types or return type). Adding columns to a `RETURNS TABLE(...)` is a return type change.

**Fix:** Drop the old function before re-creating it:
```sql
-- DROP required: PostgreSQL forbids changing return type via CREATE OR REPLACE.
DROP FUNCTION IF EXISTS function_name();
CREATE OR REPLACE FUNCTION function_name()
RETURNS TABLE (col1 type1, col2 type2, col3 type3)  -- new columns added
...
```

**Prevention:** Any time you add or remove columns from a `RETURNS TABLE(...)` RPC, add `DROP FUNCTION IF EXISTS` before the `CREATE OR REPLACE` in the migration. The `IF EXISTS` makes it safe for fresh installs. The DROP+CREATE execute atomically within the migration transaction.

---

## 2. PostgREST max_rows Silently Overrides .limit() for Counting

**What happened:** `admin_taxonomy.py` called `db.table("shop_tags").select("shop_id").limit(100_000).execute()` to fetch all tag rows and count distinct shops in Python. PostgREST's server-side `max_rows` setting (default 1000 in many deployments) silently capped the response to 1000 rows regardless of the `.limit(100_000)` call. The distinct shop count was therefore wrong and silent — no error, just a truncated number.

**Root cause:** PostgREST enforces `max_rows` on the server as a safety ceiling. The Python client's `.limit()` sets the client's requested limit but cannot exceed the server's maximum. When the actual row count exceeds `max_rows`, the truncation is silent.

**Fix:** Never count or aggregate rows by fetching them in Python from PostgREST. Use a Postgres-side aggregate function:
```sql
CREATE OR REPLACE FUNCTION my_count_rpc()
RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT COUNT(DISTINCT shop_id) FROM shop_tags;
$$;
```
Then call `db.rpc("my_count_rpc", {}).execute()` in Python.

**Prevention:** Any time you need a COUNT, SUM, or DISTINCT count from a large table, use an RPC. Do not fetch rows to Python for aggregation — you cannot guarantee the full dataset was returned.
