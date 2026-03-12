# CLAUDE.md — CafeRoam (啡遊)

## What You're Building

**CafeRoam (啡遊)** is a mobile-first web directory for Taiwan's independent coffee shop scene, powered by AI semantic search and multi-mode discovery (work/rest/social), designed to become the go-to shareable Threads link when someone asks "where should I go?"

**For complete product specifications:** See [PRD.md](PRD.md) and [SPEC.md](SPEC.md)

---

## Tech Stack Quick Reference

- **Frontend:** Next.js 16 (App Router), TypeScript (strict)
- **Backend:** FastAPI (Python 3.12+), Pydantic, uvicorn — [ADR: why Python over TypeScript](docs/decisions/2026-02-24-python-backend-over-typescript.md)
- **Styling:** Tailwind CSS + shadcn/ui
- **Database:** Supabase (Postgres 15 + pgvector)
- **Auth:** Supabase Auth (JWT sessions)
- **Hosting:** Railway (two services: Next.js frontend + Python API/workers)
- **Storage:** Supabase Storage (check-in photos, menu photos)
- **Maps:** Mapbox GL JS (via MapsProvider protocol)
- **Frontend testing:** Vitest + Testing Library
- **Backend testing:** pytest + pytest-asyncio
- **Key integrations:** Claude (enrichment), OpenAI text-embedding-3-small (vectors), Resend (email), PostHog (analytics), Sentry (errors)

**Full technical architecture:** [SPEC.md](SPEC.md)

---

## Commands

### Frontend (Next.js)

```bash
pnpm install                   # Install frontend dependencies
pnpm dev                       # Dev server :3000
pnpm build                     # Production build
pnpm lint                      # next lint
pnpm format:check              # prettier --check .
pnpm type-check                # tsc --noEmit
pnpm test                      # vitest run
pnpm test:coverage             # vitest run --coverage
```

### Backend (FastAPI)

```bash
cd backend && uv sync          # Install Python dependencies
uvicorn main:app --reload --port 8000  # Dev server :8000
pytest                         # Run backend tests
pytest --cov                   # Backend test coverage
ruff check .                   # Lint Python code
ruff format .                  # Format Python code
mypy .                         # Type check Python code
```

### Database (Supabase)

```bash
supabase start                 # Start local Supabase (requires Docker)
supabase db diff               # Check migration state BEFORE pushing
supabase db push               # Apply migrations to local
pnpm db:seed                   # Import ~50 Taipei shops from Cafe Nomad API
supabase db reset              # Reset local DB + reseed
```

**See [ERROR-PREVENTION.md](ERROR-PREVENTION.md)** for common migration errors.

---

## Environment Preflight

- **Before any environment-dependent work** (DB queries, migrations, running dev servers), run `make doctor` and fix all failures before proceeding.
- Never assume Supabase is running or `.env.local` is correct — verify with `make doctor`.
- **When adding a new service, external dependency, or env var**, update `scripts/doctor.sh` with a corresponding health check. The doctor script must grow with the project.

---

## Critical Business Logic

> **For complete specifications:** [SPEC.md](SPEC.md)

1. **Auth wall:** Unauthenticated users get directory + map + shop detail only. Semantic search, lists, and check-ins require login.
2. **Lists cap:** Max 3 lists per user. Enforce at the API level — not just the UI.
3. **Check-in requires photo:** At least one photo upload is mandatory. Text note and menu photo are optional.
4. **Stamps are per-shop:** One stamp design per shop. Multiple check-ins at the same shop earn duplicate stamps (intended collection mechanic).
5. **PDPA cascade on deletion:** Account deletion must cascade all personal data — check-in photos (Supabase Storage), text notes, lists, stamps, profile. Non-negotiable. Build before launch.
6. **Provider abstraction:** Never import provider SDKs in business logic. Always use Protocol classes from `backend/providers/`.

---

## Coding Standards

### Provider Abstraction (Python Backend)

- Define protocol first: `backend/providers/[service]/interface.py`
- Implement adapter: `backend/providers/[service]/[provider]_adapter.py`
- Wire via factory + FastAPI Depends: `backend/providers/[service]/__init__.py`
- Never call provider SDK from outside `backend/providers/`

### Database

- Always run `supabase db diff` before `supabase db push`
- RLS policies required on all user-facing tables
- Never store user PII outside Supabase (no logs, no analytics events with email or raw user IDs)

### Performance Standards

- **O(1) first**: Use set/dict/Map/Set for membership checks; prefer generators over materializing full collections
- **No work in loops**: Hoist regex compile, JSON/date parsing, and DB/API calls out of any loop; batch calls at end, not per-item
- **Python**: `re.compile()` at module level; `executemany`/bulk upserts over row-by-row; no `SELECT *`; evaluate querysets once
- **Database**: No N+1 queries (use JOINs or `IN()`); index FKs and frequently-filtered columns; CTEs over correlated subqueries
- **Frontend**: No inline object/array in render without `useMemo`; `Map` over `Array.find()` in list renders; deduplicate at SWR/fetch layer
- **Workers**: Deduplicate inputs before queuing; batch DB writes at batch end; cap concurrency explicitly — never unbounded fan-out

---

## Testing

**Full philosophy:** [`docs/testing-philosophy.md`](docs/testing-philosophy.md) — read this before writing any test.

### Core Principles (non-negotiable)

1. **Mock at boundaries only** — mock at system edges (auth SDK, HTTP, DB). Never mock your own modules or internal functions. Tooling doesn't matter (`vi.mock()`, MSW, etc.) — the boundary principle does.
2. **Frame tests from user journeys** — test descriptions must describe a user action or outcome, not a function name. "Given a user with 3 lists, when they try to create a 4th, then they see an error" not "returns 400 when limit exceeded".
3. **Realistic test data** — never `{ name: "test", email: "test@test.com" }`. Use data factories or realistic values.
4. **Test the behavior, not the implementation** — a test that breaks on internal refactors without breaking user behavior is wrong.

### Test Priority (Testing Trophy shape)

| Layer       | Weight | When to use                                                            |
| ----------- | ------ | ---------------------------------------------------------------------- |
| Integration | Most   | User flows involving multiple parts (auth → redirect, form → API → DB) |
| Unit        | Some   | Pure logic only (validators, transforms, calculations)                 |
| E2E         | Few    | 3–5 critical paths only (signup, search, check-in)                     |

### Critical Paths Requiring Tests

**Backend (pytest):**

- `backend/services/search_service.py` — semantic search + taxonomy boost logic
- `backend/services/checkin_service.py` — photo upload, stamp generation
- `backend/services/lists_service.py` — list CRUD, **3-list cap enforcement**
- `backend/providers/` — all provider adapters
- `backend/api/` — all API route handlers (auth validation, input validation)

**Frontend (Vitest + Testing Library):**

- Auth flows — login, signup, OAuth callback, consent
- List management — create, delete, cap enforcement
- Check-in — photo upload validation, form submission
- Search — query → results rendering
- Profile — stamp collection, check-in history

### Test Quality Checklist

Before finishing any test, verify:

- [ ] Test description describes a user action or outcome
- [ ] Mocks are only at HTTP/auth/DB boundaries
- [ ] Test would survive an internal refactor that preserves behavior
- [ ] Test data is realistic, not placeholder strings

---

## Spec & PRD Governance

- **Single source of truth:** `SPEC.md` (technical), `PRD.md` (product), `ASSUMPTIONS.md` (risks + open bets)
- **All changes logged:** Every `SPEC.md` edit → `SPEC_CHANGELOG.md` entry. Every `PRD.md` edit → `PRD_CHANGELOG.md` entry.
- **Significant decisions:** Also documented in `docs/decisions/` as ADRs.
- **Brainstorming alignment check:** Before designing any feature, read `SPEC.md` (business rules, constraints), `PRD.md` (vision, success metrics), AND `ASSUMPTIONS.md` (active risks). Surface conflicts as soft flags.

**Changelog entry format:** `YYYY-MM-DD | Section changed | What changed | Why`

---

## Project-Specific Security

- **Secrets:** Never commit `.env` or `.env.local`. Use `.env.example` for documentation only.
- **PDPA compliance:** Never log or track user PII in analytics events. Use anonymized user IDs only. Account deletion must cascade all personal data.
- **Check-in photos:** Stored in Supabase Storage with RLS. Only the owning user can access their photos. Disclose at check-in time that menu photos may be used for data enrichment.
- **Sensitive context:** Use `PRIVATE_CONTEXT.md` (gitignored) for business-sensitive notes.
- **CI scanning:** `security.yml` runs TruffleHog + Semgrep + pnpm audit on every push. Check GitHub Security tab for SARIF results.
