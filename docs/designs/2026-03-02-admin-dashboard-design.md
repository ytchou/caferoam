# Admin Dashboard Design — CafeRoam

> Date: 2026-03-02
> Status: Approved
> Phase: 1 (Foundation)
> Completes: Phase 1 gate — "Admin can add and edit shop data"

---

## Problem

Phase 1 backend has 5 admin API endpoints (pipeline overview, submissions, dead-letter, retry, reject) but no frontend to use them. SPEC.md lists "Internal data quality dashboard, manual enrichment and verification UI" as Phase 1. The Phase 1 "done when" gate requires "Admin can add and edit shop data."

## Approach

Page-per-concern admin dashboard inside the existing Next.js app as an `app/(admin)/` route group. 5 pages, each focused on one operational concern. Reuses existing Supabase auth, Tailwind, shadcn/ui. Desktop-optimized, mobile-friendly.

Selected over: (a) single-page tabbed dashboard (too cramped for this scope), (b) Supabase Studio hybrid (poor DX, doesn't meet Phase 1 gate).

---

## Architecture

### Route Structure

```
app/(admin)/
├── layout.tsx              # Admin layout: sidebar + breadcrumbs
├── page.tsx                # Dashboard: pipeline overview
├── shops/
│   ├── page.tsx            # Shops list + create
│   └── [id]/
│       └── page.tsx        # Shop detail + enrichment viewer + actions
├── jobs/
│   └── page.tsx            # Job queue browser
└── taxonomy/
    └── page.tsx            # Tag coverage + frequency stats
```

### Auth

**Backend:** Existing `_require_admin` dependency checks JWT user ID against `settings.admin_user_ids`. No change needed.

**Frontend:** Next.js middleware checks `(admin)` routes server-side. The middleware calls the backend `/admin/pipeline/overview` endpoint (or a lightweight `/admin/whoami`) to validate admin status. Admin user IDs are NOT exposed in `NEXT_PUBLIC_*` env vars — all admin checks happen server-side.

> **Gemini challenge (important):** Original design used `NEXT_PUBLIC_ADMIN_USER_IDS` which would expose admin UUIDs in the client JS bundle. Resolved: server-side middleware check instead. For future scale, consider migrating to Supabase `app_metadata.role = "admin"` set via Supabase dashboard.

### Data Flow

```
Browser → Next.js middleware (server-side admin check)
       → app/(admin)/ page (client component)
       → fetch /api/admin/* (Next.js proxy routes)
       → Python backend /admin/* endpoints
       → Supabase (service role client, bypasses RLS)
```

All admin backend endpoints use `get_service_role_client()` — bypasses RLS to read/write across all users' data. This is the established pattern in existing admin routes.

> **Gemini challenge (important — accepted risk):** Service role is "god mode." If `_require_admin` has a logic error, attacker gets full DB access. Mitigated by double-gating (middleware + backend). Accepted for V1 — a solo-dev project doesn't need granular admin RLS policies.

### Layout

Minimal sidebar nav: Dashboard / Shops / Jobs / Taxonomy. Top bar with breadcrumbs and current user indicator. Desktop-optimized but mobile-friendly (shadcn components are responsive by default).

---

## Pages

### 1. Dashboard (`/admin`)

Pipeline health at a glance.

- **Job queue summary cards:** pending, claimed, completed, failed, dead_letter counts
- **Recent submissions table:** status, Google Maps URL, submitted by, created_at, action buttons (approve/reject)
- **Failed jobs alert:** count badge + link to `/admin/jobs?status=failed`
- **Data source:** existing `GET /admin/pipeline/overview` endpoint

### 2. Shops List (`/admin/shops`)

Browse and manage all shops regardless of processing status.

- **Table columns:** name, address, processing_status, source, enriched_at, tag count, has_embedding
- **Search:** by name (text search)
- **Filters:** processing_status dropdown, source dropdown
- **Actions:** "Create Shop" button opens inline form (name, Google Maps URL, source=manual)
- **Row click:** navigates to `/admin/shops/[id]`

### 3. Shop Detail (`/admin/shops/[id]`)

Full enrichment viewer with pipeline replay actions.

**Identity section:**

- Name, address, coordinates, hours, source, processing_status
- Inline edit for identity fields (saves via `PUT /admin/shops/{id}`)

**Enrichment section:**

- AI-generated summary, mode scores (work/rest/social/specialty as bar chart), last enriched timestamp

**Tags section:**

- All tags with confidence scores, sorted by confidence descending
- Visual: horizontal confidence bar per tag (0.0–1.0)

**Photos section:**

- Grid of shop_photos with category labels (exterior, interior, menu, etc.)

**Actions bar:**

- "Re-enrich" — enqueues `ENRICH_SHOP` job
- "Re-embed" — enqueues `GENERATE_EMBEDDING` job
- "Re-scrape" — enqueues `SCRAPE_SHOP` job
- "Set Live" / "Unpublish" — toggle processing_status
- "Test Search" — inline search box, runs query, shows where this shop ranks in results

**Pipeline replay semantics:**

Re-enrich/re-embed/re-scrape overwrite AI-generated fields only: summary, tags, mode_scores, embedding vector. They never overwrite manually-edited identity fields (name, address, hours). A `manually_edited_at` timestamp on the shops table distinguishes admin edits from pipeline writes. Pipeline handlers check this field and skip overwriting identity fields when it's set.

> **Gemini challenge (important — resolved):** Pipeline replay could overwrite manual admin edits. Resolved: replay targets AI-generated fields only, `manually_edited_at` protects identity fields.

### 4. Jobs (`/admin/jobs`)

Full job queue browser with management actions.

- **Table columns:** job_type, status, priority, attempts, created_at, claimed_at, last_error (truncated)
- **Filters:** job_type dropdown, status dropdown
- **Expand row:** full payload JSON viewer + full error text
- **Actions:** retry (for failed/dead_letter), cancel (for pending/claimed)

### 5. Taxonomy (`/admin/taxonomy`)

Data quality overview for the enrichment pipeline.

- **Coverage stats cards:** total shops, shops with tags, shops with embeddings, shops missing either
- **Tag frequency table:** tag name, category, shop count, avg confidence — sortable by any column
- **Low-confidence list:** shops where max tag confidence < 0.5 (likely bad enrichments)
- **Missing embeddings list:** shops with tags but no embedding vector

---

## New Backend Endpoints

### Admin Shops Router (`/admin/shops`)

| Endpoint                        | Method | Purpose                                                                                      |
| ------------------------------- | ------ | -------------------------------------------------------------------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------ |
| `/admin/shops`                  | GET    | All shops (any processing_status), search by name, filter by status/source. Paginated.       |
| `/admin/shops`                  | POST   | Manual shop creation (name, google_maps_url, source=manual). Sets processing_status=pending. |
| `/admin/shops/{id}`             | GET    | Full shop detail including tags, photos, mode_scores.                                        |
| `/admin/shops/{id}`             | PUT    | Update shop identity fields. Sets `manually_edited_at` timestamp.                            |
| `/admin/shops/{id}/enqueue`     | POST   | Enqueue a job (body: `{job_type: "ENRICH_SHOP"                                               | "GENERATE_EMBEDDING" | "SCRAPE_SHOP"}`). Idempotent: if a pending job of that type already exists for this shop, returns 409. |
| `/admin/shops/{id}/search-rank` | GET    | Query param: `?query=...`. Runs search, returns this shop's rank position + total results.   |

### Admin Jobs Router (extend existing `/admin/pipeline`)

| Endpoint                           | Method | Purpose                                                                                |
| ---------------------------------- | ------ | -------------------------------------------------------------------------------------- |
| `/admin/pipeline/jobs`             | GET    | All jobs, filter by `job_type` and `status`. Paginated.                                |
| `/admin/pipeline/jobs/{id}/cancel` | POST   | Cancel pending/claimed job (sets status=dead_letter with reason "Cancelled by admin"). |

### Admin Taxonomy Router (`/admin/taxonomy`)

| Endpoint                | Method | Purpose                                                                          |
| ----------------------- | ------ | -------------------------------------------------------------------------------- |
| `/admin/taxonomy/stats` | GET    | Coverage stats + tag frequency + low-confidence shops + missing-embedding shops. |

## Audit Logging

All successful admin write operations (POST, PUT, DELETE) are logged to an `admin_audit_logs` table:

| Column        | Type        | Description                                                    |
| ------------- | ----------- | -------------------------------------------------------------- |
| id            | uuid        | PK                                                             |
| admin_user_id | uuid        | Who performed the action                                       |
| action        | text        | Endpoint path + method (e.g., "POST /admin/shops/abc/enqueue") |
| target_type   | text        | "shop", "job", "submission"                                    |
| target_id     | text        | ID of the affected resource                                    |
| payload       | jsonb       | Request body (for create/update) or action details             |
| created_at    | timestamptz | When                                                           |

Implemented as a FastAPI middleware or decorator on admin routers — not per-endpoint boilerplate.

> **Gemini challenge (important — resolved):** Original design had no audit trail. Added `admin_audit_logs` table with middleware-level logging.

---

## Frontend Proxy Routes

New Next.js API proxy routes mirroring backend endpoints:

```
app/api/admin/
├── shops/
│   ├── route.ts                    # GET (list), POST (create)
│   └── [id]/
│       ├── route.ts                # GET (detail), PUT (update)
│       ├── enqueue/route.ts        # POST
│       └── search-rank/route.ts    # GET
├── pipeline/
│   ├── jobs/
│   │   ├── route.ts                # GET (list)
│   │   └── [id]/
│   │       └── cancel/route.ts     # POST
│   └── ... (existing routes)
└── taxonomy/
    └── stats/route.ts              # GET
```

All proxies follow existing pattern: forward Authorization header, stream response, forward content-type.

---

## DB Changes

1. **`shops` table:** Add `manually_edited_at timestamptz` column (nullable, default null)
2. **`admin_audit_logs` table:** New table (schema above)
3. **Migration:** Single migration file for both changes

---

## Error Handling

- Toast notifications (shadcn/ui Sonner) for all admin actions — success and error
- Failed API calls show backend error message inline
- Enqueue actions are idempotent: duplicate pending job → 409 with message
- Destructive actions (reject submission, cancel job, unpublish shop) require confirmation dialog

---

## Testing Strategy

**Backend (pytest):**

- All new admin endpoints: CRUD operations, enqueue logic (including idempotency), taxonomy stats aggregation, search-rank query
- Audit logging: verify logs are written for write operations
- Follow existing `test_admin.py` pattern with `_require_admin` dependency override

**Frontend (vitest):**

- Admin page components render correct data states: loading, empty, populated, error
- Action buttons trigger correct API calls with correct params
- Confirmation dialogs block destructive actions until confirmed
- No deep integration tests — internal tooling doesn't need the same rigor as user-facing features
