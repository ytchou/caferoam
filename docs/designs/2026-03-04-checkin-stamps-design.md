# Design: Check-in & Stamps

Date: 2026-03-04
Status: Approved

---

## Scope

Full check-in & stamps user journey:

1. Check-in page (`/checkin/[shopId]`) — photo upload, note, optional menu photo
2. Photo upload to Supabase Storage (direct client upload, JWT auth)
3. Stamp reveal (toast notification on success)
4. Profile stamps view — passport-style grid, swipeable pages
5. Recent check-ins strip on Shop Detail — photo grid + count badge

**Backend is already complete.** This design covers frontend UI, storage bucket setup, and one new API endpoint.

---

## Architecture Overview

```
Check-in Page (/checkin/[shopId])
│
├── PhotoUploader → Supabase Storage (direct, JWT auth)
│     checkin-photos/{user_id}/{uuid}.webp
│
└── POST /api/checkins → FastAPI → DB INSERT
                               ↓ DB trigger (existing)
                          stamps table (atomic, no extra call)
                               ↓ stamp URL derived client-side
                          Toast: /stamps/{shop_id}.svg
```

### Photo upload approach

Direct client upload to Supabase Storage using the user's session JWT (RLS-protected bucket). After all uploads complete, the client POSTs resulting URLs to the existing `POST /checkins` API. No files routed through the backend.

Alternatives rejected:

- **Signed URL upload** — extra round-trip, no meaningful security benefit over RLS in V1
- **Backend proxy (multipart)** — routes large files through two servers, breaks thin-proxy rule

### Storage bucket: `checkin-photos`

- Single bucket for both check-in photos and menu photos (path-prefixed)
- Paths: `checkin-photos/{user_id}/{uuid}.webp`
- Menu photo paths: `menu-photos/{user_id}/{uuid}.webp` (separate bucket for clarity)
- Not fully public — URLs are UUID-based (not guessable); shown only to logged-in users via API
- PDPA deletion: account deletion cascades `{user_id}/` path in both buckets
- RLS: authenticated users can INSERT/SELECT their own path only

### Stamp URL derivation

Stamp design URL is deterministic: `/stamps/{shop_id}.svg`. Derived client-side after successful check-in POST — no extra API call needed. The DB trigger creates the stamp row atomically; we show the stamp thumbnail in the toast without waiting for a stamps fetch.

---

## New Backend Work

The existing backend (`CheckInService`, `POST /checkins`, `GET /stamps`) is complete and tested. Two additions needed:

### 1. `GET /shops/{shopId}/checkins` endpoint

Returns the latest check-ins for a specific shop (for the Recent Check-ins grid on Shop Detail). Currently `GET /checkins/` only returns the authenticated user's own check-ins.

```python
# backend/api/shops.py (or new checkins route)
GET /shops/{shop_id}/checkins?limit=9
# Returns: List[CheckInSummary] — id, user_id, username, photo_urls[0], note, created_at
# Auth: required (logged-in users only)
```

### 2. Supabase Storage migration

New SQL migration creating `checkin-photos` and `menu-photos` storage buckets with RLS policies.

```sql
-- Create buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('checkin-photos', 'checkin-photos', false),
       ('menu-photos', 'menu-photos', false);

-- RLS: users can upload to their own path
CREATE POLICY "Users can upload their own check-in photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'checkin-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- RLS: authenticated users can read any check-in photo
CREATE POLICY "Authenticated users can view check-in photos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'checkin-photos');

-- RLS: users can delete their own photos
CREATE POLICY "Users can delete their own check-in photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'checkin-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Same policies for menu-photos
```

---

## Pages & Components

### 1. Check-in Page (`/checkin/[shopId]`)

**Route:** `/checkin/[shopId]`
**Auth:** Required — redirect to `/login?next=/checkin/[shopId]`
**Entry point:** "打卡記錄 Check In →" button on Shop Detail

**Layout (mobile-first, single column):**

```
┌─────────────────────────────┐
│  ← Brewing Grounds          │  ← back link to /shop/[shopId]
│  Check In                   │
├─────────────────────────────┤
│  [📷 Take Photo / Add Photo]│  ← primary upload CTA
│  [thumb1] [thumb2] [+ Add] │  ← thumbnails of selected photos
│                             │
│  Note (optional)            │
│  ┌─────────────────────┐   │
│  │ What did you have?  │   │
│  │ 今天點了什麼？      │   │
│  └─────────────────────┘   │
│                             │
│  ▸ Menu photo (optional)   │  ← collapsible section
│    [upload area]            │
│    "May be used to improve  │
│     shop information."      │
│                             │
│  [  打卡 Check In  ]        │  ← disabled until 1+ photo selected
└─────────────────────────────┘
```

**Photo upload input behavior:**

- **Mobile** (detected via `pointer: coarse` media query): `<input type="file" accept="image/*" capture="environment">` — camera opens by default. Secondary "Choose from gallery" tap target below.
- **Desktop**: `<input type="file" accept="image/*">` — standard system file picker. No `capture` attribute.
- Max 3 photos, ≤ 5 MB each, image types only (client-side validation before upload).
- Each thumbnail shows an × remove button.

**Submit state machine:**

```
idle → uploading (per-photo progress) → submitting → success → navigate back
                                                    → error (toast with retry)
```

**On success:**

- Navigate back to `/shop/[shopId]`
- Show stamp reveal toast (see below)

**PDPA disclosure:** Menu photo collapsible section includes disclosure text at upload area: _"Menu photos may be used to improve shop information on CafeRoam."_ Required per SPEC §5.

### 2. Stamp Reveal Toast

Slides up from bottom after successful check-in:

```
┌────────────────────────────────────────┐
│  [stamp SVG]  打卡成功！Stamp earned.  │
│               View Collection →        │
└────────────────────────────────────────┘
```

- Stamp SVG: `<img src="/stamps/{shop_id}.svg">` — derived from the shop_id in the response
- Auto-dismisses after 4 seconds
- "View Collection →" navigates to `/profile#stamps`

### 3. Profile Stamps — Passport Grid

**Location:** `/profile` page, stamps section (or linked tab)

**Layout:**

```
┌──────────────────────────────────────────┐
│  My Passport              12 stamps      │
│                                          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │ 🏅 │ │ 🏅 │ │ ○  │ │ ○  │  ...     │
│  └────┘ └────┘ └────┘ └────┘            │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐            │
│  │ ○  │ │ ○  │ │ ○  │ │ ○  │            │
│  └────┘ └────┘ └────┘ └────┘            │
│  ...  (4 × 5 = 20 slots per page)       │
│                                          │
│              ● ○ ○                       │  ← page dots
└──────────────────────────────────────────┘
```

- Filled slot: stamp SVG for that shop
- Empty slot: faded circle outline
- Stamps ordered by `earned_at DESC` (most recent first fills from top-left)
- Tap filled stamp → bottom sheet: shop name, earned date, "Visit Again →" link to `/shop/[shopId]`
- Swipe gesture or dot navigation to move between pages (CSS scroll-snap or Embla Carousel)
- Page 2 appears once 20 stamps earned (first page full)

**Components:**

- `StampPassport` — container, manages pages
- `PassportPage` — 4×5 grid of slots
- `StampSlot` — filled (stamp SVG) or empty (circle outline)
- `StampDetailSheet` — bottom sheet on tap

### 4. Recent Check-ins Strip on Shop Detail

**Location:** Section within `/shop/[shopId]`, below shop info.

**Logged-in users:**

```
┌──────────────────────────────────────────┐
│  Recent Check-ins              47 visits │
│                                          │
│  ┌──────┐ ┌──────┐ ┌──────┐             │
│  │  📷  │ │  📷  │ │  📷  │             │
│  └──────┘ └──────┘ └──────┘             │
│  ┌──────┐ ┌──────┐ ┌──────┐             │
│  │  📷  │ │  📷  │ │  📷  │             │
│  └──────┘ └──────┘ └──────┘             │
│  ┌──────┐ ┌──────┐ ┌──────┐             │
│  │  📷  │ │  📷  │ │  📷  │             │
│  └──────┘ └──────┘ └──────┘             │
│                    [See all check-ins]   │
└──────────────────────────────────────────┘
```

- 3-column grid, latest 9 photos (from `GET /shops/{shopId}/checkins?limit=9`)
- Count badge: total check-in count (from shops table `checkin_count` or COUNT query)
- Tap photo → lightbox: full image, @username, date, note text (if any)
- "See all" → `/shop/[shopId]/checkins` (out of scope this sprint — render as disabled or omit)

**Unauthenticated users:**

```
┌──────────────────────────────────────────┐
│  Recent Check-ins              47 visits │
│  ┌──────────────────────────────────┐   │
│  │  [representative photo, blurred] │   │
│  │  Log in to see all check-ins →   │   │
│  └──────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

- Single representative photo (first photo from most recent check-in)
- Blurred/dimmed overlay with login CTA
- Uses a separate `GET /shops/{shopId}/checkins/preview` endpoint (public, returns only 1 photo + total count) or derives from shop record

**Components:**

- `CheckInPhotoGrid` — auth-aware, renders full grid or teaser
- `CheckInPhotoLightbox` — modal on tap
- `CheckInCountBadge` — "X visits" display

---

## Error Handling

| Scenario                     | Handling                                                   |
| ---------------------------- | ---------------------------------------------------------- |
| Upload fails (network)       | Per-photo error with retry button; other photos unaffected |
| File too large (>5 MB)       | Inline validation error before upload starts               |
| Invalid file type            | Inline error; file rejected                                |
| Max photos exceeded          | Disable "+ Add" button after 3 photos                      |
| Check-in POST fails          | Error toast: "Check-in failed. Try again." with retry      |
| No photos selected on submit | Submit button remains disabled (prevented at UI level)     |

---

## Testing Strategy

### Frontend (Vitest + Testing Library)

- `CheckInPage` — blocks submit without photo; shows upload progress; navigates on success; renders PDPA disclosure in menu photo section
- `PhotoUploader` — rejects >3 files; rejects >5 MB; rejects non-image types; shows thumbnails; × removes photo
- `StampPassport` — renders correct page count; empty slots shown; tap-to-detail bottom sheet; page navigation works
- `CheckInPhotoGrid` — shows count badge; limits to 9 photos; lightbox opens on tap; unauthenticated teaser renders
- Integration: mock Supabase Storage upload (resolve with URL) + mock `POST /checkins` response → stamp toast appears with correct stamp URL

### Backend (new test needed)

- `test_get_shop_checkins` — returns check-ins for a shop ordered by created_at DESC; auth required (401 if not logged in); respects limit param

### Migration

- Manual verification: confirm bucket policies restrict cross-user access; confirm `{user_id}/` path deletion works for PDPA cascade

---

## Implementation Notes

- Stamp design URL is deterministic (`/stamps/{shop_id}.svg`) — no extra GET after check-in creation
- `checkin_count` on shops table: consider a DB trigger or materialized approach to keep this in sync (or COUNT at query time for V1)
- Menu photo collapsible should default to closed to reduce visual complexity and lower perceived friction (Assumption U2)
- Check-in page accessed from Shop Detail only (deep-linked button); no standalone navigation entry
