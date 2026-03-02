# Technical Specification: CafeRoam (啡遊)

> Last updated: 2026-03-02
> For complete product requirements: see PRD.md

---

## 1. Tech Stack

| Layer            | Choice                            | Notes                                                |
| ---------------- | --------------------------------- | ---------------------------------------------------- |
| Frontend         | Next.js 16 (App Router)           | SSR/SSG for SEO, mobile-first, shareable URLs        |
| Frontend lang    | TypeScript (strict)               | Frontend + prebuild data pipeline only               |
| Backend          | FastAPI (Python 3.12+)            | API + workers + business logic                       |
| Backend lang     | Python (typed, mypy-checked)      | All backend services, providers, workers             |
| Database         | Supabase (Postgres 15 + pgvector) | Vector search, auth, storage in one platform         |
| Auth             | Supabase Auth                     | Email/password + social login options                |
| Hosting          | Railway (two services)            | Next.js frontend + Python API/workers, same monorepo |
| Styling          | Tailwind CSS + shadcn/ui          | Fast iteration, mobile-first design                  |
| Frontend testing | Vitest + Testing Library          | Frontend unit + integration tests                    |
| Backend testing  | pytest + pytest-asyncio           | API + service + worker tests                         |
| Maps             | Mapbox GL JS                      | Abstracted behind MapsProvider protocol              |
| Storage          | Supabase Storage                  | Check-in photos, menu photos; RLS enforced           |
| Error tracking   | Sentry                            | Frontend + backend, free tier at launch              |
| Analytics        | PostHog                           | Via AnalyticsProvider protocol abstraction           |
| Uptime           | Better Stack                      | 30-second checks, Slack/Discord + email alerts       |

**Full rationale for each choice:** see `docs/decisions/`

---

## 2. System Modules

| Module                | Responsibility                                                                                                                            | Phase |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----- |
| Data pipeline         | One-time data collection (Cafe Nomad seed → Apify/Google Maps verify + scrape) + ongoing enrichment (Claude Haiku + embedding generation) | 1     |
| Taxonomy system       | Canonical tag database; powers filter UI and search ranking                                                                               | 1     |
| Auth system           | Supabase Auth, session management, route protection, PDPA consent                                                                         | 1     |
| Provider abstractions | LLMProvider, EmbeddingsProvider, EmailProvider, MapsProvider, AnalyticsProvider (Python Protocol classes)                                 | 1     |
| Admin/ops             | Internal data quality dashboard, manual enrichment and verification UI                                                                    | 1     |
| Background workers    | FastAPI embedded workers (APScheduler): enrichment, embedding refresh, weekly email cron                                                  | 1     |
| Shop directory        | Mobile list view + mobile/desktop map view; responsive layouts at ≥1024px; geolocation; multi-dimension filters                           | 2     |
| Semantic search       | pgvector similarity + taxonomy boost; AI search bar with suggestion chips and mode chips on Home and Map screens                          | 2     |
| User lists            | Create/edit/delete (max 3), add/remove shops                                                                                              | 2     |
| Check-in system       | Standalone check-in page; photo upload (required), text note (optional), menu photo (optional); stamp generation; unlocks review          | 2     |
| Reviews               | Check-in-gated reviews: star rating + text, one review per user per shop, visible to logged-in users on Shop Detail page                  | 2     |
| User profile          | Private profile page: check-in history, stamp collection, lists                                                                           | 2     |
| Retention             | Weekly curated email (fixed schedule), stamp collection display                                                                           | 3     |

---

## 3. Architecture Overview

CafeRoam is a monorepo with two Railway services: a Next.js frontend (TypeScript) and a FastAPI backend (Python). Supabase provides the data backend (Postgres + pgvector, auth, storage). The Next.js frontend handles SSR/SSG pages and thin API proxy routes. The Python backend handles all business logic, provider integrations, and background workers.

**Frontend → Backend communication:** Next.js API routes act as thin proxies, forwarding requests (with auth headers) to the Python backend via Railway's internal network. The Python API is not publicly exposed.

**Semantic search flow:** User query → Next.js proxy → FastAPI route → embed query via EmbeddingsProvider (OpenAI text-embedding-3-small) → pgvector similarity search on Supabase → taxonomy tag boost (structured component) → ranked results → response. This hybrid approach (vector similarity + taxonomy boost) handles both natural language queries and attribute-specific queries ("must have outlets") better than pure vector search.

**Check-in flow:** User uploads photo → Next.js proxy → FastAPI route → validate auth + photo → Supabase Storage → stamp awarded → optional: menu photo queued for enrichment worker → Claude extracts structured menu data → merged into shop record.

**Provider abstraction pattern:** All external services (LLM, embeddings, email, maps, analytics) are accessed via Python `Protocol` classes. Business logic imports only protocols — never provider SDKs. Factory functions select the active provider from env vars and are wired via FastAPI's `Depends()` system for dependency injection and test mocking.

```
backend/providers/
├── llm/
│   ├── interface.py              # LLMProvider protocol
│   ├── anthropic_adapter.py      # Claude (default)
│   └── __init__.py               # factory: get_llm_provider()
├── embeddings/
│   ├── interface.py              # EmbeddingsProvider protocol
│   ├── openai_adapter.py         # text-embedding-3-small (default)
│   └── __init__.py
├── email/
│   ├── interface.py              # EmailProvider protocol
│   ├── resend_adapter.py         # Resend (default)
│   └── __init__.py
├── maps/
│   ├── interface.py              # MapsProvider protocol
│   ├── mapbox_adapter.py         # Mapbox GL JS (default)
│   └── __init__.py
└── analytics/
    ├── interface.py              # AnalyticsProvider protocol
    ├── posthog_adapter.py        # PostHog (default)
    └── __init__.py
```

---

## 4. Hard Dependencies

Things that must exist for this product to ship. If any of these slip, the timeline slips.

| Dependency                    | Type                              | Provider Abstracted       | Risk if unavailable                             |
| ----------------------------- | --------------------------------- | ------------------------- | ----------------------------------------------- |
| Supabase                      | Database + Auth + Storage         | No (core infrastructure)  | Complete block                                  |
| Railway                       | App hosting + worker runtime      | No (infrastructure)       | Deployment blocked                              |
| Apify                         | Google Maps data scraping         | Lightweight wrapper       | Data pipeline blocked                           |
| Claude Haiku (Anthropic)      | LLM enrichment + taxonomy tagging | Yes — ILLMProvider        | Enrichment quality degraded; fallback to manual |
| OpenAI text-embedding-3-small | Vector embeddings for search      | Yes — IEmbeddingsProvider | Semantic search blocked                         |
| Mapbox GL JS                  | Map rendering                     | Yes — IMapsProvider       | Map view unavailable; list view unaffected      |
| Resend (default)              | Transactional email               | Yes — IEmailProvider      | Weekly email blocked                            |
| PostHog                       | Product analytics                 | Yes — IAnalyticsProvider  | Analytics blind; product still functional       |

**LLM enrichment rationale:** Claude Haiku chosen over GPT-4o for structured extraction with constrained output (taxonomy mapping). Claude consistently outperforms on instruction-following when output is constrained to a predefined list — critical for clean taxonomy tagging. Fast and cheap for batch processing. User maintains separate Anthropic service account for CafeRoam.

**Embeddings rationale:** OpenAI text-embedding-3-small is the pragmatic choice — ~$0.02/1M tokens, reliable, best pgvector ecosystem support. Anthropic does not offer standalone embedding models. Google text-embedding-004 is the preferred fallback if OpenAI is unavailable (user has Gemini subscription).

---

## 5. Compliance & Security

- **Compliance:** Taiwan PDPA (個人資料保護法). Key requirements: explicit consent at signup for data collection purposes; user right to delete account + all personal data within 30 days; purpose limitation — disclose that check-in photos may inform data enrichment; data retention policy for photos and check-in history.
- **PDPA checkpoints during build:** Consent flow at signup, account deletion endpoint (cascades all user data: check-ins, photos, lists, stamps, profile), privacy policy page, photo usage disclosure on check-in flow.
- **Auth mechanism:** Supabase Auth (JWT-based sessions). Server-side session validation on all protected API routes.
- **Secrets management:** Environment variables only. `.env` and `.env.local` are gitignored. `.env.example` documents all required vars with descriptions.
- **Encryption:** In transit: TLS/HTTPS (Railway + Supabase enforce). At rest: Supabase Storage encrypts by default.
- **Data residency:** Supabase region — `ap-southeast-1` (Singapore; closest to Taiwan).
- **RLS:** Supabase Row Level Security enabled on all user-facing tables. Users can only read/write their own data (check-ins, lists, stamps, profile).

---

## 6. Observability

- **Error tracking:** Sentry — captures frontend + API route errors. Alert on new error types. Free tier sufficient at launch.
- **Logging:** Railway built-in log viewer for app and worker logs. Structured JSON logs.
- **Uptime monitoring:** Better Stack — 30-second checks on production URLs. Slack/Discord + email alerts on downtime. Public status page.
- **Analytics:** PostHog via IAnalyticsProvider. Seven instrumented events (defined in `docs/designs/ux/metrics.md`): `search_submitted` (query_text, query_type, mode_chip_active, result_count), `shop_detail_viewed` (shop_id, referrer, session_search_query), `shop_url_copied` (shop_id, copy_method), `checkin_completed` (shop_id, is_first_checkin_at_shop, has_text_note, has_menu_photo), `profile_stamps_viewed` (stamp_count), `filter_applied` (filter_type, filter_value), `session_start` (days_since_first_session, previous_sessions). `query_type` classification runs server-side. Never log user PII in analytics events.
- **Alerting:** Sentry (new errors, email), Better Stack (downtime, Slack/Discord), Railway (worker crash logs).

---

## 7. Dev Environment

- **Target setup time:** Under 15 minutes from `git clone` to running app
- **Prerequisites:** Node.js 20+, pnpm, Python 3.12+, uv (Python package manager), Docker Desktop, Supabase CLI, Railway CLI

```bash
git clone <repo> && cd caferoam
cp .env.example .env.local     # Fill in API keys (~2 min)
pnpm setup                     # Runs all steps automatically

# What pnpm setup does:
# 1. pnpm install                        (~2 min — frontend deps)
# 2. cd backend && uv sync               (~1 min — Python backend deps)
# 3. supabase start                      (~3 min first time — pulls Docker images)
# 4. supabase db push                    (~30 sec)
# 5. pnpm db:seed                        (~1 min — imports ~50 Taipei shops)
# 6. pnpm dev                            (starts Next.js on :3000 + FastAPI on :8000)
```

- **Makefile shortcuts:** `make migrate`, `make seed`, `make reset-db`, `make backend`, `make test-backend`
- **Local Supabase:** Full Postgres + pgvector + auth + storage runs in Docker — no cloud credentials needed for local development.
- **Backend dev server:** `cd backend && uvicorn main:app --reload --port 8000`

---

## 8. Technical Constraints & Known Trade-offs

- **Supabase vendor dependency:** Auth, database, and storage are all Supabase. Moving off requires significant migration work. Accepted: speed of launch outweighs flexibility at this stage.
- **pgvector hybrid search:** Pure vector similarity degrades for attribute-specific queries ("must have outlets"). The taxonomy tag boost mitigates this, but search quality is ultimately bounded by enrichment data quality.
- **Map performance on low-end devices:** Mapbox GL JS can be heavy on older Android devices common in Taiwan. Mitigation: lazy-load the map, only render pins in viewport, provide list view as fallback.
- **Data freshness:** Enriched data degrades as shops change menus, hours, or close. Check-in menu photos partially automate refresh, but periodic manual verification is an ongoing maintenance task.
- **Railway vs serverless:** Railway runs as persistent services (not serverless functions), which means no cold starts and no timeout limits on long-running enrichment jobs — a deliberate choice for the data pipeline.
- **Two-language stack:** TypeScript (frontend) + Python (backend) means two dependency systems and two testing frameworks. Accepted: team productivity in Python and access to the Python AI/ML ecosystem outweigh the overhead. The prebuild data pipeline stays in TypeScript as it's already working.
- **Solo dev timeline:** 2-4 weeks is aggressive. The 30-shop data enrichment + semantic search prototype (week 0) must prove the wedge before investing in full build.

---

## 9. Business Rules

> This section is checked by every /brainstorming session before designing a feature. Keep it current. Any rule that shapes how the system behaves goes here.

- **Auth wall:** Unauthenticated users can browse directory (list view, map view, shop detail, filters) but cannot access semantic search, user lists, check-ins, or profile.
- **Semantic search is auth-gated:** The chatbox on the landing page is visible to all users but prompts login when submitted without an active session.
- **Lists cap:** A user can have at most 3 lists. Enforced at the API level, not just UI. Exceeding 3 returns a 400 error.
- **Lists are private in V1:** No user can view another user's lists. No shareable list links in V1.
- **Check-in requires photo:** At least one photo upload is mandatory for a check-in to be recorded. Text note is optional. Menu photo is optional.
- **Check-in deduplication:** A user can check in to the same shop multiple times. No deduplication — multiple visits earn multiple stamps (intended collection mechanic).
- **Stamps:** One unique stamp design per shop. Multiple check-ins at the same shop earn duplicate stamps of that design. Stamps are non-transferable and non-purchasable in V1.
- **Profile is private:** The user profile page is only accessible to the authenticated user who owns it. Not publicly viewable in V1.
- **Weekly email:** Fixed schedule. All opted-in users receive the same curated content in V1. No personalization until usage data exists.
- **PDPA data deletion:** Account deletion must cascade all personal data: check-in photos (Supabase Storage), text notes, lists, stamps, profile data. Must complete within 30 days of request. Non-negotiable — must be built before launch.
- **Provider abstraction:** Business logic never imports provider SDKs directly. All external services accessed via Python Protocol classes in `backend/providers/`.
- **Taxonomy is canonical:** Filter UI options and LLM enrichment prompts both derive from the taxonomy table. Adding a new tag to the taxonomy automatically makes it available in filters and future enrichment runs.
- **Check-in page is standalone:** The check-in flow lives at `/checkin/[shopId]` — a separate page, not a tab on Shop Detail. Reached via the "打卡記錄 Check In →" button on Shop Detail. This applies on both mobile and desktop.
- **Reviews are check-in-gated:** A user can leave a star rating + text review only after completing at least one check-in at that shop. Reviews are optional — a check-in with no review is valid. One review per user per shop (latest overwrites previous). Reviews are visible to logged-in users only on Shop Detail.
- **Check-in social visibility:** On Shop Detail, unauthenticated visitors see only the total check-in count and one representative photo. Logged-in users see the full Recent Check-ins strip (photo thumbnails with @username and date). Review text is never shown to unauthenticated visitors.
- **Responsive layouts (UX-defined):** Two distinct layout sets exist. Mobile (< 1024px): Home (terracotta search-hero with suggestion chips), Map (full-bleed + glassmorphism overlay), Shop Detail (single-column scroll). Desktop (≥ 1024px): Home (search-first landing, centered search bar, no hero map), Map (full-viewport map + floating card), Shop Detail (2-column: content left / photo carousel + map + CTA right). See `docs/designs/ux/DESIGN_HANDOFF.md` for approved screenshots and layout intent.
