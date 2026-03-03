# Project Roadmap: CafeRoam (啡遊)

> For complete product requirements: PRD.md
> For technical decisions: SPEC.md
> Granular task breakdown happens in docs/plans/ after /brainstorming sessions.

---

## Pre-Build: Validate Fatal Assumptions (Week 0)

Must complete BEFORE starting Phase 1. These are FATAL risks from VALIDATION.md — if they fail, stop and reassess before writing product code.

### Data Collection

> **Design Doc:** [docs/designs/2026-02-23-data-collection-pipeline-design.md](docs/designs/2026-02-23-data-collection-pipeline-design.md)
> **Plan:** [docs/plans/2026-02-23-data-collection-pipeline-plan.md](docs/plans/2026-02-23-data-collection-pipeline-plan.md)

**Pipeline Setup:**

- [x] Project setup (package.json, tsconfig, vitest, .gitignore)
- [x] Type definitions (CafeNomadEntry, Pass0/1/2Shop)

**Pipeline Utilities:**

- [x] Filters with TDD (closed, shell, bounds, dedup)
- [x] Matching with TDD (fuzzy name + coordinate proximity)
- [x] Apify client wrapper

**Pipeline Scripts:**

- [x] Pass 0: Cafe Nomad seed (free, ~30s)
- [x] Pass 1: Verify open status via Apify (~$6.40)
- [x] Pass 2: Full scrape with reviews + photos (~$15-18)

**Validation (30-shop subset):**

- [x] Run Pass 0 on full dataset, pick 30 diverse shops
- [x] Run Pass 1 on 30 shops, verify >80% match rate
- [x] Run Pass 2 on confirmed shops, inspect data quality
- [x] Check: reviews present, photos present, some menu URLs found

### Enrichment & Embeddings

> **Design Doc:** [docs/designs/2026-02-23-enrichment-embeddings-design.md](docs/designs/2026-02-23-enrichment-embeddings-design.md)
> **Plan:** [docs/plans/2026-02-23-enrichment-embeddings-plan.md](docs/plans/2026-02-23-enrichment-embeddings-plan.md)

**Chunk 1 — Foundation (Wave 1-2):**

- [x] Install SDK dependencies (@anthropic-ai/sdk, openai) and extend pipeline types
- [x] Retry utility with exponential backoff (TDD)
- [x] Cosine similarity utility (TDD)
- [x] Anthropic client wrapper (tool use)
- [x] OpenAI embeddings client wrapper

**Chunk 2 — Enrichment Pipeline (Wave 3):**

- [x] Pass 3a: Taxonomy seed generator — Claude proposes tags from reviews (TDD)
- [x] ✋ Manual: Run pass3a, curate taxonomy-proposed.json → taxonomy.json
- [x] Pass 3b: Enrichment worker — Claude classifies shops against taxonomy (TDD)
- [x] Pass 4: Embedding generator — OpenAI text-embedding-3-small (TDD)

**Chunk 3 — Enrichment Post-Processing:**

> **Design Doc:** [docs/designs/2026-02-23-enrichment-postprocessor-design.md](docs/designs/2026-02-23-enrichment-postprocessor-design.md)
> **Plan:** [docs/plans/2026-02-23-enrichment-postprocessor-plan.md](docs/plans/2026-02-23-enrichment-postprocessor-plan.md)

- [x] Add ProcessedShop types (distinctiveness, multi-mode)
- [x] Pass 3c: IDF computation + tag distinctiveness scoring (TDD)
- [x] Pass 3c: Multi-mode inference tests
- [x] Update Pass 4 to read pass3c-processed.json
- [x] Update Pass 5 to use multi-mode
- [x] Add pnpm script for pass3c

**Chunk 4 — Search Validation:**

- [x] Search queries config (10 test queries)
- [x] Pass 5: Search prototype — cosine similarity + taxonomy boost (TDD)
- [x] Add pnpm scripts for all passes
- [x] ✋ Manual: Run pass3c → pass4 → pass5, score results — 7/10 gate (10/10 achieved 2026-02-23)

**Pre-build is done when:** 7+ of 10 test queries return useful, relevant results. Beta user reaction (10 people): "this is better than Google Maps." If <7/10 succeed, stop and rethink the data enrichment approach before building the full product.

---

## Phase 1: Foundation — Target: Week 1-2

Core infrastructure everything else depends on. No user-facing product yet.

### Project Setup

> **Design Doc:** [docs/designs/2026-02-23-project-setup-design.md](docs/designs/2026-02-23-project-setup-design.md)
> **Plan:** [docs/plans/2026-02-23-project-setup-plan.md](docs/plans/2026-02-23-project-setup-plan.md)

**Chunk 1 — Scaffold & Config:**

- [x] Generate Next.js 15 scaffold (temp dir)
- [x] Copy configs, merge package.json, install deps
- [x] App shell: root layout + landing page + Tailwind v4 globals
- [x] Initialize shadcn/ui

**Chunk 2 — Routes & Architecture:**

- [x] Route group skeleton (auth, protected, API stubs)
- [x] Domain types (Shop, User, List, CheckIn, Stamp, Taxonomy)
- [x] Provider interfaces (LLM, Embeddings, Email, Maps, Analytics)
- [x] Provider adapter stubs + env-based factories
- [x] Service interface stubs (Search, CheckIn, Lists)
- [x] Supabase client factory (browser + server)

**Chunk 3 — Verification:**

- [x] Full test suite passes
- [x] Lint + type-check + production build pass
- [x] All routes accessible in browser

### Database Schema + Code Review Chunk 1 & 2

> **Design Doc:** [docs/designs/2026-02-25-db-schema-and-code-review-chunk1-2-design.md](docs/designs/2026-02-25-db-schema-and-code-review-chunk1-2-design.md)
> **Plan:** [docs/plans/2026-02-25-db-schema-and-code-review-chunk1-2-plan.md](docs/plans/2026-02-25-db-schema-and-code-review-chunk1-2-plan.md)
> **Original DB Design:** [docs/designs/2026-02-24-db-infrastructure-design.md](docs/designs/2026-02-24-db-infrastructure-design.md)

**Chunk 1 — Migration Files (Wave 1):**

- [x] Copy 9 migration files from feat/db-infrastructure (fix job_queue columns, triggers, RPC)
- [x] Add DEAD_LETTER to JobStatus enum + widen Job.payload

**Chunk 2 — Per-Request JWT Auth (Wave 2-4):**

- [x] Refactor supabase_client.py (per-request JWT + service role singleton)
- [x] Add get_user_db FastAPI dependency
- [x] Wire all auth routes to per-request JWT client

**Chunk 3 — Service Simplification (Wave 5-6):**

- [x] Simplify CheckInService (trigger handles stamp + job)
- [x] Simplify ListsService (trigger cap + RLS ownership)
- [x] Update list route handlers for simplified signatures

**Chunk 4 — Verification (Wave 7):**

- [x] All tests pass, lint, type-check, build

### Python Backend Migration

> **Design Doc:** [docs/designs/2026-02-24-python-backend-migration-design.md](docs/designs/2026-02-24-python-backend-migration-design.md)
> **Plan:** [docs/plans/2026-02-24-python-backend-migration-plan.md](docs/plans/2026-02-24-python-backend-migration-plan.md)
> **Supersedes:** DB Infrastructure Plan Tasks 6+ (TypeScript workers, providers, handlers)

**Chunk 1 — Python Project Foundation (Wave 1-2):**

- [x] Python project scaffolding (pyproject.toml, config, test infra)
- [x] Pydantic domain models (translate TypeScript types)
- [x] Supabase Python client (singleton with service role)

**Chunk 2 — Provider Layer (Wave 3):**

- [x] Provider protocols (LLM, Embeddings, Email, Analytics, Maps)
- [x] Provider adapters + factory functions with TDD

**Chunk 3 — Services (Wave 4):**

- [x] Search service with TDD (vector similarity + taxonomy boost)
- [x] Check-in service with TDD (photo requirement, stamp award, menu photo queue)
- [x] Lists service with TDD (3-list cap enforcement)

**Chunk 4 — API & Workers (Wave 4-5):**

- [x] FastAPI app + JWT auth dependency with TDD
- [x] API routes (shops, search, checkins, lists, stamps)
- [x] Job queue consumer with TDD (FOR UPDATE SKIP LOCKED)
- [x] Worker handlers + APScheduler (enrich, embed, menu, staleness, email)

**Chunk 5 — Frontend Proxies & Cleanup (Wave 6-7):**

- [x] Rewrite Next.js API routes as thin proxies
- [x] Delete old TypeScript backend code (lib/providers, lib/services, lib/db, workers)
- [x] Backend Dockerfile + update package.json scripts

**Chunk 6 — Verification:**

- [x] All backend tests pass (pytest)
- [x] All frontend tests pass (vitest)
- [x] Frontend build passes (pnpm build)
- [x] ruff + mypy pass on backend

### Code Review Fixes (Python Backend)

> **Design Doc:** [docs/designs/2026-02-24-code-review-fixes-design.md](docs/designs/2026-02-24-code-review-fixes-design.md)
> **Plan:** [docs/plans/2026-02-24-code-review-fixes-plan.md](docs/plans/2026-02-24-code-review-fixes-plan.md)

**Chunk 1 — Auth/Authorization (Critical):** → Moved to "Database Schema + Code Review Chunk 1 & 2" above

**Chunk 2 — Transaction Safety (Critical/Important):** → Moved to "Database Schema + Code Review Chunk 1 & 2" above

**Chunk 3 — Data Integrity (Critical):**

- [x] Job queue retry with exponential backoff
- [x] Fix enriched_at string literal to real timestamp

**Chunk 4 — Infrastructure (Important):**

- [x] Resend email adapter: async thread wrapper + fix global state
- [x] Job.payload type widen to Any + search row.pop fix
- [x] Proxy content type forwarding
- [x] Missing list sub-resource proxy routes
- [x] Auth route (backend + frontend)
- [x] Dockerfile uv.lock fix + posthog dependency

**Chunk 5 — Tests + Verification:**

- [x] Missing handler tests (enrich_menu_photo, weekly_email)
- [x] All backend tests pass (pytest)
- [x] All frontend tests pass (vitest)
- [x] ruff + mypy pass

### Auth & Privacy

> **Design Doc:** [docs/designs/2026-02-25-auth-privacy-design.md](docs/designs/2026-02-25-auth-privacy-design.md)
> **Plan:** [docs/plans/2026-02-25-auth-privacy-plan.md](docs/plans/2026-02-25-auth-privacy-plan.md)

**Chunk 1 — DB Migrations (Wave 1-2):**

- [x] Add `deletion_requested_at` column to profiles
- [x] Custom JWT claim hook for PDPA consent + deletion status

**Chunk 2 — Backend Auth Routes (Wave 3):**

- [x] `POST /auth/consent` — record PDPA consent with TDD
- [x] `DELETE /auth/account` — initiate 30-day soft delete with TDD
- [x] `POST /auth/cancel-deletion` — cancel within grace period with TDD
- [x] Account deletion scheduler (daily cleanup job) with TDD

**Chunk 3 — Frontend Infra (Wave 3-4):**

- [x] Supabase SSR client setup (browser, server, middleware helpers)
- [x] Next.js middleware (route guards: public / onboarding / protected / recovery)

**Chunk 4 — Frontend Auth Pages (Wave 5):**

- [x] Login page (email/password + Google + LINE) with tests
- [x] Signup page (email/password + PDPA checkbox) with tests
- [x] Auth callback route (code exchange + consent check)
- [x] PDPA consent page with tests
- [x] Account recovery page with tests
- [x] Settings page (logout + account deletion)
- [x] Auth proxy routes (consent, delete, cancel-deletion)

**Chunk 5 — Verification (Wave 6):**

- [x] All backend tests pass (pytest)
- [x] All frontend tests pass (vitest)
- [x] Frontend lint, type-check, build pass

### Data Pipeline

> **Design Doc:** [docs/designs/2026-02-26-data-pipeline-design.md](docs/designs/2026-02-26-data-pipeline-design.md)
> **Plan:** [docs/plans/2026-02-26-data-pipeline-plan.md](docs/plans/2026-02-26-data-pipeline-plan.md)

**Chunk 1 — DB Migrations + Models (Wave 1-2):**

- [x] DB migrations: shop_submissions, activity_feed, find_stale_shops RPC, pipeline columns
- [x] Pydantic models: ShopSubmission, ActivityFeedEvent, ProcessingStatus, new JobTypes

**Chunk 2 — Scraper Provider + Handlers (Wave 2-3):**

- [x] Apify scraper provider (ScraperProvider protocol + ApifyScraperAdapter)
- [x] SCRAPE_SHOP handler (Apify scrape → store → chain to ENRICH_SHOP)
- [x] PUBLISH_SHOP handler (set live → activity feed → flag for admin)

**Chunk 3 — Wiring + API Routes (Wave 4-5):**

- [x] Wire new handlers into scheduler dispatch loop
- [x] POST /submissions API route (user shop submission)
- [x] GET /feed API route (public community activity feed)
- [x] Admin dashboard API (overview, dead-letter, retry, reject)

**Chunk 4 — Pipeline Features (Wave 4-5):**

- [x] Search service: IDF taxonomy boost + mode pre-filter
- [x] Smart staleness sweep (only re-enrich when new reviews detected)
- [x] Cold start importers (Google Takeout parser + Cafe Nomad fetcher)
- [x] Propagate submission_id through ENRICH → EMBED → PUBLISH chain

**Chunk 5 — Verification (Wave 6):**

- [x] All backend tests pass (pytest)
- [x] ruff + mypy pass
- [x] Frontend tests + build pass

**Deferred (post-pipeline):**

- [ ] Incremental tag classification: re-classify only delta tags when taxonomy grows
- [ ] Embedding regeneration trigger: re-embed only when enrichment actually changes

### Provider Abstractions

> **Design Doc:** [docs/designs/2026-02-26-provider-adapter-implementations-design.md](docs/designs/2026-02-26-provider-adapter-implementations-design.md)
> **Plan:** [docs/plans/2026-02-26-provider-adapter-implementations-plan.md](docs/plans/2026-02-26-provider-adapter-implementations-plan.md)

**Chunk 1 — Models & Interface (Wave 1):**

- [x] Add ShopEnrichmentInput model to types.py
- [x] Update LLM protocol interface signature

**Chunk 2 — Adapter Implementations (Wave 1-2):**

- [x] Implement Anthropic adapter enrich_shop with TDD
- [x] Add extract_menu_data tests for Anthropic adapter
- [x] Implement Mapbox geocoding adapter with TDD
- [x] Implement PostHog analytics adapter with TDD

**Chunk 3 — Wiring & Verification (Wave 3-5):**

- [x] Update LLM factory for taxonomy parameter
- [x] Add missing Maps + Analytics factory tests
- [x] Update worker handlers for new enrich_shop signature
- [x] Full verification (pytest, ruff, mypy, pnpm test)

### Observability & Ops

> **Design Doc:** [docs/designs/2026-02-27-observability-ops-design.md](docs/designs/2026-02-27-observability-ops-design.md)
> **Plan:** [docs/plans/2026-02-27-observability-ops-plan.md](docs/plans/2026-02-27-observability-ops-plan.md)

**Chunk 1 — Backend Observability (Wave 1):**

- [x] Sentry backend initialization (DSN-gated, environment context)
- [x] Request ID middleware (UUID per request, structured logging)
- [x] Deep health check endpoint (/health/deep with DB validation)

**Chunk 2 — Frontend Observability (Wave 1):**

- [x] Sentry frontend initialization (@sentry/nextjs, source maps)
- [x] PostHog frontend provider (posthog-js, DNT respect)
- [x] Environment variable documentation

**Chunk 3 — Worker Integration (Wave 2):**

- [x] Worker Sentry integration (capture job failures with context)

**Chunk 4 — Verification & Ops (Wave 3):**

- [x] Full test suite verification (backend + frontend)
- [x] Better Stack setup guide (manual external configuration)

### Admin Dashboard

> **Design Doc:** [docs/designs/2026-03-02-admin-dashboard-design.md](docs/designs/2026-03-02-admin-dashboard-design.md)
> **Plan:** [docs/plans/2026-03-02-admin-dashboard-plan.md](docs/plans/2026-03-02-admin-dashboard-plan.md)

**Chunk 1 — DB + Audit (Wave 1-2):**

- [x] DB migration: `manually_edited_at` column + `admin_audit_logs` table + low-confidence RPC
- [x] Audit log utility (`log_admin_action`) with TDD

**Chunk 2 — Backend API (Wave 3):**

- [x] Admin shops router: list, create, detail, update, enqueue, search-rank with TDD
- [x] Admin jobs router: list all + cancel endpoint with TDD
- [x] Admin taxonomy router: coverage stats endpoint with TDD
- [x] Backend verification (pytest, ruff, mypy)

**Chunk 3 — Frontend Infrastructure (Wave 5):**

- [x] Admin middleware guard (server-side `is_admin` check)
- [x] Admin proxy routes (shops, jobs, taxonomy)

**Chunk 4 — Frontend Pages (Wave 6):**

- [x] Admin layout (sidebar nav + breadcrumbs)
- [x] Dashboard page (pipeline overview, job counts, recent submissions)
- [x] Shops list page (search, filter, create)
- [x] Shop detail page (enrichment viewer, tags, photos, pipeline replay actions)
- [x] Jobs page (queue browser, retry, cancel)
- [x] Taxonomy page (coverage stats, tag frequency, low-confidence shops)

**Chunk 5 — Verification (Wave 7):**

- [x] Full verification (pytest, vitest, ruff, mypy, pnpm build)

### Admin Import Triggers

> **Design Doc:** [docs/designs/2026-03-02-admin-import-triggers-design.md](docs/designs/2026-03-02-admin-import-triggers-design.md)

**Chunk 1 — Region Config + Pre-Filter Pipeline (Wave 1):**

- [x] Shared region config (`backend/core/regions.py`): GeoBounds, Region, REGIONS dict with Greater Taipei
- [x] Pre-filter module: URL validation, fuzzy dedup (Levenshtein + coords), known-failed check, name validation
- [x] Pre-filter tests (TDD for each filter step)

**Chunk 2 — Importer Updates (Wave 2):**

- [x] Update `google_takeout.py`: accept GeoBounds, run pre-filter, mark `pending_url_check`
- [x] Update `cafe_nomad.py`: accept Region, dynamic Cafe Nomad API URL, run pre-filter
- [x] Update importer tests for new params

**Chunk 3 — Backend Routes + URL Checker (Wave 3):**

- [x] `POST /admin/shops/import/cafe-nomad` with region param
- [x] `POST /admin/shops/import/google-takeout` with multipart file upload
- [x] `POST /admin/shops/bulk-approve` (max 50/batch, staggered priority)
- [x] `POST /admin/shops/import/check-urls` (background URL validation batch)
- [x] Background URL checker worker (5 concurrent, 1s batch delay)
- [x] Route tests with TDD

**Chunk 4 — Frontend (Wave 4):**

- [x] Next.js proxy routes (4 new routes, including custom multipart proxy for Google Takeout)
- [x] Admin shops page: region dropdown, import buttons, Check URLs button
- [x] Admin shops page: bulk approve UI (checkbox selection + approve action)
- [x] Add `pending_url_check` and `pending_review` to status filters

**Chunk 5 — Verification (Wave 5):**

- [x] All backend tests pass (pytest)
- [x] ruff + mypy pass
- [x] Frontend type-check + build pass

### Test Improvement (Phase 0 + 1)

> **Design Doc:** [docs/designs/2026-02-27-test-improvement-design.md](docs/designs/2026-02-27-test-improvement-design.md)
> **Philosophy:** [docs/testing-philosophy.md](docs/testing-philosophy.md)
> **Plan:** [docs/plans/2026-02-27-test-improvement-phase-0-1-plan.md](docs/plans/2026-02-27-test-improvement-phase-0-1-plan.md)

**Phase 0 — Test Infrastructure (Wave 1-2):**

- [x] Backend test factories (make_user, make_shop_row, make_list, make_checkin, make_stamp)
- [x] Frontend test factories (makeUser, makeSession, makeShop, makeList, makeCheckIn, makeStamp)
- [x] Frontend mock helpers (createMockSupabaseAuth, createMockRouter)
- [x] Validate pattern: refactor settings/page.test.tsx to use shared utilities
- [x] Validate pattern: refactor test_search_service.py to use shared factories

**Phase 1 — Auth Test Hardening (Wave 3):**

- [x] Login: successful login redirects to home
- [x] Login: OAuth buttons call signInWithOAuth with correct provider
- [x] Signup: successful signup shows email confirmation
- [x] Signup: error display on failed signup

**Blocked — D-grade page tests (need features built in Phase 2):**

- [ ] Lists page tests (blocked until lists CRUD feature)
- [ ] Search page tests (blocked until semantic search UI)
- [ ] Profile page tests (blocked until profile page)

### Data Seeding — Get Shops Into Supabase

This is the final gate for Phase 1. Two paths: fast path seeds 29 pre-built shops to unblock Phase 2 dev immediately; full pipeline reaches the 200+ shop target.

**Chunk 1 — Local environment:**

- [ ] Run `supabase start` and confirm Studio accessible at http://localhost:54323
- [ ] Run `supabase db push` and confirm all migrations applied (check for errors in output)
- [ ] Confirm `supabase/migrations/20260302000003_tagged_shop_count_rpc.sql` is the latest — `supabase db diff` should show no pending changes
- [ ] Set required env vars in `backend/.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `APIFY_API_TOKEN`

**Chunk 2 — Full pipeline: import via Google Takeout + reach 200+ shops:**

> Requires a Google Takeout export of your saved places. The importer reads the GeoJSON, inserts shops as `pending`, and queues SCRAPE_SHOP jobs. The worker chain then handles SCRAPE → ENRICH → EMBED → PUBLISH automatically.

- [ ] Export Google Maps saved places: Google Account → Data & Privacy → Download your data → select "Saved" → export as JSON → unzip and locate `Takeout/Maps/Saved Places.json`
- [ ] Write `backend/scripts/run_takeout_import.py`:
  - Accept GeoJSON file path as CLI arg (`sys.argv[1]`)
  - Load and parse the file
  - Call `import_takeout_to_queue(geojson, db, queue)` from `importers/google_takeout.py`
  - Print count of shops queued
- [ ] Start backend: `cd backend && uvicorn main:app --reload --port 8000`
- [ ] Run import: `cd backend && uv run python scripts/run_takeout_import.py /path/to/Saved\ Places.json`
- [ ] Confirm SCRAPE_SHOP jobs queued — check `/admin/jobs` or `GET /admin/pipeline/jobs?status=pending`
- [ ] Let worker run (APScheduler fires every 30s) — monitor progress in admin dashboard
- [ ] Pipeline chain completes: SCRAPE_SHOP → ENRICH_SHOP → EMBED_SHOP → PUBLISH_SHOP
- [ ] Verify: `SELECT COUNT(*) FROM shops WHERE processing_status = 'live'` ≥ 200
- [ ] Verify: dead-letter queue empty or investigated (`GET /admin/pipeline/dead-letter`)
- [ ] Spot-check search quality: run 5 queries from `scripts/prebuild/data-pipeline/pass5-search-test.ts` against the live API

**Phase 1 is done when:** 200+ shops are live in the database with taxonomy tags and embeddings. Auth works end-to-end including PDPA consent and account deletion. Admin can add and edit shop data. `git clone` → running app in under 15 minutes.

---

## Phase 2A: UGC Flows — No Data Required

> Start immediately — no dependency on Phase 1 data gate.
> These flows are self-contained: they need auth + DB schema, but not a populated shop corpus.
> Use the 29 pre-built seed shops for integration testing.

> **UX reference:** All approved mockups in `docs/designs/ux/screenshots/`. Layout intent in `docs/designs/ux/DESIGN_HANDOFF.md`. Personas and friction points in `docs/designs/ux/personas.md` and `journeys.md`. PostHog events in `docs/designs/ux/metrics.md`.

### User Lists
> **Design Doc:** [docs/designs/2026-03-03-user-lists-design.md](docs/designs/2026-03-03-user-lists-design.md)
> **Plan:** [docs/plans/2026-03-03-user-lists-plan.md](docs/plans/2026-03-03-user-lists-plan.md)

**Wave 1 — Foundation:**
- [ ] Install frontend deps (swr, vaul, react-map-gl, mapbox-gl)
- [ ] Backend: enhance `get_by_user` to include list items

**Wave 2 — Backend endpoints + Frontend primitives:**
- [ ] Backend: `GET /lists/pins` endpoint
- [ ] Backend: `GET /lists/{list_id}/shops` endpoint
- [ ] Backend: `PATCH /lists/{list_id}` rename endpoint
- [ ] Frontend types + factories update
- [ ] Drawer UI component (vaul wrapper)

**Wave 3 — Frontend core:**
- [ ] Frontend API proxy routes (pins, shops, rename)
- [ ] `useUserLists` SWR hook with derived state + optimistic mutations

**Wave 4 — UI components:**
- [ ] `BookmarkButton` component
- [ ] `SaveToListSheet` bottom sheet
- [ ] `RenameListDialog` component
- [ ] `ListCard` component

**Wave 5 — Pages:**
- [ ] `/lists` page (list cards, create, rename, delete)
- [ ] `/lists/[listId]` page (split map + shop list + hover highlight)

**Wave 6 — Validation:**
- [ ] Full test suite + type-check + lint pass

### Check-in & Stamps

- [ ] Check-in page (`/checkin/[shopId]`): standalone page, NOT a tab on Shop Detail
- [ ] Check-in form: photo upload (required), text note (optional), menu photo (optional)
- [ ] Menu photo pipeline: optional check-in menu photo → enrichment worker queue
- [ ] Stamp/collectible: one stamp design per shop, earned on check-in
- [ ] `checkin_completed` PostHog event: shop_id, is_first_checkin_at_shop, has_text_note, has_menu_photo

### Reviews

- [ ] Review system: star rating + text, available only after at least one check-in at that shop
- [ ] One review per user per shop (latest overwrites); reviews visible to logged-in users only on Shop Detail
- [ ] Review DB table + API routes (`GET /shops/:id/reviews`, `POST /shops/:id/reviews`)
- [ ] Check-in count + single representative photo visible to unauthenticated visitors on Shop Detail (full strip + @username shown to logged-in users only)

### User Profile

- [ ] Private user profile page: check-in history, stamp collection, lists
- [ ] `profile_stamps_viewed` PostHog event: stamp_count

### UGC Analytics Instrumentation

- [ ] `checkin_completed` PostHog event: shop_id, is_first_checkin_at_shop, has_text_note, has_menu_photo
- [ ] `profile_stamps_viewed` PostHog event: stamp_count
- [ ] `session_start` event: days_since_first_session, previous_sessions

### Unblock Phase 2B Test Coverage

These page-level tests were blocked pending Phase 2 features — complete once features above are built:

- [ ] Lists page tests (create, cap enforcement, add/remove shop)
- [ ] Profile page tests (stamp collection, check-in history)

**Phase 2A is done when:** A user can sign up, check in with a photo at a seed shop, earn a stamp, create a list, leave a review, and view their profile — all without a full shop corpus. PostHog confirms `checkin_completed`, `profile_stamps_viewed`, and `session_start` fire correctly.

---

## Phase 2B: Discovery & Search Flows — Requires 200+ Live Shops

> Blocked on Phase 1 data gate: `SELECT COUNT(*) FROM shops WHERE processing_status = 'live'` ≥ 200.
> Can be designed and partially scaffolded in parallel, but cannot be fully built or tested without real data.

> **UX reference:** Same as Phase 2A above.

### Shop Discovery & Directory

- [ ] Mobile Home screen: terracotta search-hero, AI search bar with sparkle icon, suggestion chips (巴斯克蛋糕/適合工作/安靜一點/我附近), mode chips (工作/放鬆/社交/精品), filter pills row (`search-v3-approved.png`)
- [ ] Desktop Home screen: search-first landing, centered hero search bar, suggestion chips, 3-column editorial cards grid, "View on map →" link — ≥1024px only (`home-desktop-v2-approved.png`)
- [ ] Mobile Map screen: full-bleed Mapbox, glassmorphism search + filter overlay, terracotta pins, bottom mini card on pin select (`map-v1-approved.png`)
- [ ] Desktop Map screen: full-viewport map, floating glassmorphism nav, filter pills, bottom-left floating shop card, "List View" toggle (`map-desktop-v1-approved.png`)
- [ ] Shop Detail (mobile): single-column scroll — hero photo, shop identity, attribute chips, curated description, menu highlights, Recent Check-ins photo strip (auth-gated), reviews (auth-gated), map thumbnail, sticky "Check In →" bar (`shop-detail-v3-approved.png`)
- [ ] Shop Detail (desktop): 2-column — left scrollable content, right sticky column (photo carousel + map + CTA) (`shop-detail-desktop-v2-approved.png`)
- [ ] Geolocation: "nearby me" — requests location permission, filters shops by proximity
- [ ] Multi-dimension filters: functionality, time, ambience, mode (all powered by taxonomy); opens bottom-sheet on mobile

### Semantic Search

- [ ] AI search bar: natural language queries, suggestion chips pre-fill search, mode chips apply semantic filter
- [ ] pgvector + taxonomy boost search results, ranked list
- [ ] Auth gate on semantic search: prompt login when unauthenticated user submits query
- [ ] `search_submitted` PostHog event: query_text, query_type (server-side classified), mode_chip_active, result_count
- [ ] Server-side `query_type` classification (item_specific / specialty_coffee / general) — never exposed client-side

### Discovery Analytics Instrumentation

- [ ] `shop_detail_viewed` event: shop_id, referrer (search/map_pin/direct), session_search_query
- [ ] `shop_url_copied` event: shop_id, copy_method (native_share/clipboard)
- [ ] `filter_applied` event: filter_type, filter_value

### Performance

- [ ] Mobile-first UI: design and test at 390px width first
- [ ] Desktop breakpoint: ≥1024px — two distinct layout systems, not just stretched mobile
- [ ] Map performance: lazy-load Mapbox, viewport-only pins, static Mapbox image for Shop Detail map thumbnail
- [ ] Core Web Vitals: LCP < 2.5s, CLS < 0.1
- [ ] `backdrop-filter: blur()` fallback for glassmorphism on Android

### Unblock Phase 2B Test Coverage

- [ ] Search page tests (blocked until semantic search UI + real search results)

**Phase 2B is done when:** A non-team beta user can sign up, complete the PDPA consent flow, search semantically, find a coffee shop, check in with a photo, earn a stamp, leave a review, and view their profile — all without assistance. PostHog Live Events confirms all 7 instrumented events fire correctly.

---

## Phase 3: Beta & Launch — Target: Week 3-4

30-50 person beta → public Threads launch.

### Beta Program

- [ ] Recruit 30-50 beta users (personal network + Threads coffee community)
- [ ] LINE group for beta feedback collection
- [ ] Iterate on beta feedback: data gaps, search quality issues, UX friction

### Activate Observability Stack

Code is merged and env-gated — nothing fires until these are set in Railway:

_Sentry:_

- [ ] Create Sentry project → set `SENTRY_DSN` (backend Railway service) and `NEXT_PUBLIC_SENTRY_DSN` (frontend Railway service)
- [ ] Create Sentry auth token → set `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` in Railway (source map uploads on deploy)
- [ ] Trigger a test error post-deploy to confirm events arrive in Sentry

_PostHog:_

- [ ] Create PostHog project → set `NEXT_PUBLIC_POSTHOG_KEY` in Railway (frontend)
- [ ] Confirm `NEXT_PUBLIC_POSTHOG_HOST` is set (defaults to `https://app.posthog.com` if omitted)
- [ ] Verify pageview events in PostHog Live Events after first deploy

_Better Stack:_

- [ ] Create Better Stack account → follow `docs/ops/better-stack-setup.md` to add 3 monitors (API Health, Web Health, API Deep Health)
- [ ] Configure Slack/Discord webhook alert policy (2 consecutive failures before alert)
- [ ] Create `status.caferoam.com` status page → add CNAME in DNS

### Quality Gate

- [ ] Weekly curated email: template + Railway cron job + Resend integration
- [ ] Map performance audit: test on low-end Android devices
- [ ] Security review: RLS policies, PDPA flow, Sentry error baseline
- [ ] SQL lint passing on all migrations

### Launch

- [ ] Public Threads launch post with beta user testimonials

**Phase 3 is done when:** 20+ of 30 beta users say "better than Google Maps/Cafe Nomad." Public Threads post published. Better Stack shows 99%+ uptime during 2-week beta. 50+ WAU achieved.

---

## Backlog (Post-MVP)

Explicitly cut from V1. Revisit after Phase 3 validation data is in hand.

### Social & Community

- [ ] Public user profiles + social check-in feed
- [ ] Shareable curated lists (Letterboxd model: "My top 5 study cafes in Da'an")
- [ ] Community data contributions (flag outdated info, add new shops)

### Monetization & Business

- [ ] Shop owner claiming + premium pages (analytics, menu management)
- [ ] CAFFÈCOIN integration (discovery → transaction affiliate)
- [ ] Sponsored / featured placement monetization

### Growth & Expansion

- [ ] Personalized weekly email (behavior-driven curation)
- [ ] Recommendation engine trained on real usage data
- [ ] Coverage expansion beyond Taipei
- [ ] Native iOS/Android app (after Threads distribution is proven)

### LINE Integration (V2)

> Requires LINE Login (built in V1 auth) as prerequisite — LINE user ID is captured at auth time.

- [ ] LINE Official Account setup (LINE Developer Console)
- [ ] Push notifications via LINE Messaging API (replace or supplement weekly email)
- [ ] Rich menu: quick-access to search, check-in, lists from within LINE app
- [ ] Chatbot: natural language shop discovery via LINE chat (semantic search over Messaging API)
