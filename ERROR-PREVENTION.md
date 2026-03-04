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

## Cross-Language API Contract Drift (TypeScript ↔ Python)

**Symptom:** Frontend shows `undefined` for all shop fields; API calls return 404, 405, or 422; a count is always 0 even though data exists.

**Root cause:** TypeScript frontend and Python backend developed in parallel without a shared type system. Common divergences: (1) response shape (nested vs flat), (2) missing proxy routes, (3) HTTP method mismatch (PATCH vs PUT), (4) query param name mismatch (`q` vs `query`), (5) wrong RPC return field names.

**Fix:** Match each `fetch()` call against the FastAPI route: verify URL, method, query params, response shape. Create missing proxy routes immediately.

**Prevention:**

- When writing any `fetch()` call, immediately open the corresponding FastAPI route handler and cross-check: URL, HTTP method, query param names, JSON response shape
- Front-end test mocks must match the actual backend response shape — not an assumed shape
- Missing proxy route = 404 at runtime. Create `app/api/admin/X/route.ts` alongside the backend endpoint

---

## Test Mock Path Drift After Module Refactoring

**Symptom:** Tests that patched `api.module_name.settings` suddenly fail (AttributeError or 403) after extracting logic to `api/deps.py`.

**Root cause:** `unittest.mock.patch("api.X.settings")` patches the name where it is **used**, not where it is **defined**. After moving shared dependencies to `deps.py`, `settings` is no longer imported in `api/X.py`.

**Fix:** Update all patch paths from `api.X.settings` → `api.deps.settings`.

**Prevention:**

- After any `deps.py` extraction, grep for `patch("api.<old_module>.settings")` across all test files and update the path
- Prefer `app.dependency_overrides[require_admin] = lambda: {"id": "admin-id"}` over patching settings — it's immune to module path changes

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

## RLS UPDATE Policy Missing — PATCH Endpoint Silently Returns 404

**Symptom:** PATCH endpoint appears correct in application logic but always returns 404. No Python exception. Supabase returns `data=[]` with no error.

**Root cause:** Supabase RLS silently blocks UPDATE operations when no matching `FOR UPDATE` policy exists. The application sees empty `data=[]` and treats it as "not found".

**Fix:** Add `CREATE POLICY "check_ins_own_update" ON check_ins FOR UPDATE USING (auth.uid() = user_id);` in the feature's migration.

**Prevention:** When adding any PATCH/PUT/DELETE endpoint, check the RLS migration for a corresponding `FOR UPDATE`/`FOR DELETE` policy before writing application code. Add the policy in the same migration as the feature's schema changes.

---

## Python snake_case → TypeScript Interface Must Match Wire Format

**Symptom:** All fields from an API response render as `undefined` in the UI. No network error. Response JSON is correct when inspected in DevTools.

**Root cause:** Pydantic `model_dump()` outputs snake_case. `fetchWithAuth()` does NOT camelCase-convert responses. TypeScript interface was written in camelCase (JavaScript convention), so all fields are `undefined` at runtime.

**Fix:** Change TypeScript interface fields to snake_case to match the Python Pydantic model. Update all component references.

**Prevention:** TypeScript interfaces for API responses must mirror Python Pydantic model field names (snake_case). camelCase convention applies only to locally-computed state and component props. When writing a new Pydantic model + TypeScript interface pair, write the TS interface immediately after the Python model and verify field names match exactly.

---

_Add entries here as you discover them._
