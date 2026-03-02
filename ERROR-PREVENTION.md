# Error Prevention: CafeRoam (啡遊)

Known errors, their symptoms, causes, and fixes. Add an entry every time you hit a non-obvious problem.

**Format:** Symptom → Root cause → Fix → How to prevent

---

## Template

### [Error name / symptom]

**Symptom:** [What you see when this happens]

**Root cause:** [Why it happens]

**Fix:**

```bash
# Commands or steps to fix it
```

**Prevention:** [What to check or do to avoid this in the future]

---

## Supabase Migration Out of Sync

**Symptom:** `supabase db push` fails with "migration already applied" or schema drift errors.

**Root cause:** Local migration history is out of sync with what's been applied to the database, usually from running raw SQL in the Supabase dashboard instead of through migrations.

**Fix:**

```bash
supabase db diff           # See what's different
supabase db reset          # Nuclear option: reset local DB entirely and reapply all migrations
```

**Prevention:** Never run schema-changing SQL directly in the Supabase dashboard. Always create a migration file via `supabase migration new [name]` and apply with `supabase db push`.

---

## pgvector Extension Not Available

**Symptom:** `ERROR: type "vector" does not exist` when running migrations locally.

**Root cause:** pgvector extension not enabled in local Supabase instance.

**Fix:**

```sql
-- Add to migration file or run manually once:
CREATE EXTENSION IF NOT EXISTS vector;
```

**Prevention:** Include `CREATE EXTENSION IF NOT EXISTS vector;` as the first migration. The seed script should check for this before inserting embeddings.

---

## RLS Policy Blocking Authenticated Requests

**Symptom:** Authenticated API routes return empty results or 403 errors despite valid session.

**Root cause:** RLS policy missing or incorrectly written for the table being queried. Common mistake: forgetting `auth.uid()` check on user-scoped tables.

**Fix:**

```sql
-- Check existing policies:
SELECT * FROM pg_policies WHERE tablename = '[table_name]';

-- Standard user-scoped read policy:
CREATE POLICY "Users can read own data" ON [table]
  FOR SELECT USING (auth.uid() = user_id);
```

**Prevention:** After every new table migration, immediately write and test RLS policies. Run `supabase db diff` to confirm policies are in migration files, not just applied manually.

---

## PostgreSQL: Cannot Change RPC Return Type via CREATE OR REPLACE

**Symptom:** Migration fails with `ERROR: cannot change return type of existing function` when adding columns to a `RETURNS TABLE(...)` RPC.

**Root cause:** `CREATE OR REPLACE FUNCTION` can only modify the function body — not its signature. Adding or removing columns from `RETURNS TABLE(...)` is a return type change, which PostgreSQL forbids.

**Fix:**

```sql
-- DROP required before changing return type:
DROP FUNCTION IF EXISTS my_rpc_name();
CREATE OR REPLACE FUNCTION my_rpc_name()
RETURNS TABLE (col1 text, col2 bigint, col3 numeric)  -- new signature
...
```

**Prevention:** Whenever you add/remove columns from a `RETURNS TABLE(...)` function in a migration, prefix with `DROP FUNCTION IF EXISTS`. The `IF EXISTS` makes it safe for fresh installs.

---

## PostgREST: Server max_rows Silently Caps Python Row Fetches

**Symptom:** A Python-side count/aggregate that fetches rows from PostgREST returns a suspiciously round number (e.g., exactly 1000). No error is raised — the response is silently truncated.

**Root cause:** PostgREST enforces a server-side `max_rows` ceiling (default 1000) that overrides the client's `.limit()`. You cannot request more rows than the server allows.

**Fix:** Use a Postgres-side aggregate RPC instead of fetching rows to Python:

```sql
CREATE OR REPLACE FUNCTION my_count()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT COUNT(DISTINCT shop_id) FROM shop_tags; $$;
```

```python
result = db.rpc("my_count", {}).execute()
count = int(result.data or 0)
```

**Prevention:** Never fetch rows to Python for aggregation (COUNT, SUM, DISTINCT). Use an RPC for any aggregate that might exceed 1000 rows.

---

_Add entries here as you discover them._
