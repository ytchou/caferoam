# Phase 2B Completion: All Deferred Work — Design

Date: 2026-03-14

> **Prerequisite:** Phase 2B Discovery UI (PR #29) shipped all 4 core pages. This design covers every deferred item from the code review + remaining TODO.md unchecked items.

---

## Scope

All unchecked items from TODO.md § Phase 2B: Discovery & Search Flows — Chunk 6 (analytics), Chunk 7 (deferred from code review), and Performance validation.

---

## Wave 1: Backend Foundation

### 1a. Pydantic camelCase serialization

**Problem:** Backend returns snake_case JSON (`review_count`, `label_zh`), frontend expects camelCase (`reviewCount`, `labelZh`). Components have defensive dual-casing workarounds scattered throughout.

**Solution:** Add a `CamelModel` base class with Pydantic's `alias_generator = to_camel` + `populate_by_name = True`. All API response models inherit from it. Python code stays snake_case internally; JSON responses serialize as camelCase.

**Files:**

- `backend/models/types.py` — add `CamelModel`, update `Shop`, `TaxonomyTag`, `ShopDetail`, response models
- Backend tests asserting on JSON keys — update to camelCase

**ADR:** `docs/decisions/2026-03-14-pydantic-camel-case-serialization.md`

### 1b. Structured taxonomy_tags response

**Problem:** `GET /shops/{id}` returns `tags: string[]` (flat tag names). Frontend needs `taxonomyTags: TaxonomyTag[]` with `{ id, dimension, label, labelZh }` for filtering and display.

**Solution:** JOIN `shop_tags` → `taxonomy_tags` table in the shops endpoint. Return full `TaxonomyTag` objects via the `CamelModel` serialization.

**Files:**

- `backend/api/shops.py` — update `get_shop()` and `list_shops()` queries
- `backend/api/shops.py` — response construction uses TaxonomyTag model

---

## Wave 2: Frontend Type Consolidation

### 2a. Remove dual-casing workarounds

With Wave 1 complete, API responses are natively camelCase. Remove all defensive patterns:

- `AttributeChips`: remove `tag.label_zh ?? tag.labelZh ?? tag.label` fallback
- `ShopDetailClient`: remove union type for `taxonomy_tags | tags`
- `useShopDetail`, `useShops`: no transform needed — types match directly
- `lib/types/index.ts`: verify `Shop` and `TaxonomyTag` interfaces match API response

**Files:**

- `components/shops/attribute-chips.tsx`
- `app/shops/[shopId]/[slug]/shop-detail-client.tsx`
- `lib/hooks/use-shop-detail.ts`
- `lib/hooks/use-shops.ts`
- `lib/types/index.ts`

---

## Wave 3: UI Components

### 3a. MapDesktopCard

New component: `components/map/map-desktop-card.tsx`

**Spec (from design handoff):**

- Position: bottom-left floating, ~340px width, `z-10`
- Content stack: photo thumbnails (horizontal strip), shop name + neighborhood, rating + Open badge, attribute chips (max 5), dual buttons (View Details terracotta primary + Check In ghost secondary)
- Animation: slide up with `transition-transform` on pin select
- Shown on desktop (`useIsDesktop`) only, replaces MapMiniCard
- No dismiss button (differs from mobile mini card)

**Integration:** `app/map/page.tsx` renders `MapDesktopCard` when `isDesktop && selectedShop`.

### 3b. Shop Detail sub-components

Extract from `shop-detail-client.tsx` into separate files under `components/shops/`:

**`ShopDescription`** (`components/shops/shop-description.tsx`)

- 2-line clamp with "Read more" button that expands full text
- Uses `line-clamp-2` + state toggle

**`MenuHighlights`** (`components/shops/menu-highlights.tsx`)

- Up to 3 items rendered as emoji + name + price
- Data from shop enrichment `menu_highlights` field
- Graceful empty state (hidden if no data)

**`RecentCheckinsStrip`** (`components/shops/recent-checkins-strip.tsx`)

- Auth-gated via `useUser()` hook
- Unauth: total count + one preview photo thumbnail
- Auth: horizontal scroll of photo thumbnails with `@username` + date
- Data from `GET /api/shops/{id}/checkins?limit=10` (new endpoint or embed in shop detail response)

**`ShopMapThumbnail`** (`components/shops/shop-map-thumbnail.tsx`)

- Mobile: static Mapbox image via Static Images API (~5KB)
- Desktop: interactive `react-map-gl` embed in sticky right column
- Uses `useIsDesktop()` to switch rendering

---

## Wave 4: Feature Enhancements

### 4a. Viewport-only pin filtering

**Problem:** MapView renders all shop markers regardless of zoom level. Performance degrades with 200+ shops.

**Solution:** Add `onViewportChange` callback to MapView. Filter `shops` array to those within current map bounds before rendering `<Marker>` components.

**Implementation:**

- `MapView` tracks viewport bounds via `onMove` event from react-map-gl
- `useMemo` filters shops to `lat/lng` within `bounds.north/south/east/west`
- Only filtered shops render as markers

**Files:** `components/map/map-view.tsx`

### 4b. "我附近" geolocation

**Trigger:** User taps "我附近" suggestion chip.

**Flow:**

1. `SuggestionChips` passes special identifier (not literal string)
2. Parent calls `navigator.geolocation.getCurrentPosition()`
3. Success: navigate with `?lat=...&lng=...&radius=5` (km)
4. Error/denied: toast "無法取得位置，改用文字搜尋" + fall back to text query "我附近"
5. Backend search supports `lat`, `lng`, `radius` params for proximity ranking

**Files:**

- `components/discovery/suggestion-chips.tsx` — distinguish "我附近" from other chips
- Parent pages (`app/page.tsx`, `app/map/page.tsx`) — handle geolocation flow
- `lib/hooks/use-geolocation.ts` — new hook wrapping `navigator.geolocation`

---

## Wave 5: Analytics Instrumentation

### 5a. `filter_applied` event

Verify current wiring in `FilterPills` and `FilterSheet`. If already firing, mark TODO complete. If not, wire `capture('filter_applied', { filter_type, filter_value })` on filter toggle/apply.

### 5b. `search_submitted` enrichment

Add properties to existing event:

- `result_count`: from SWR response data length (fire after results load, not on submit)
- `mode_chip_active`: from `useSearchState().mode` (string or null)

**Files:** `app/(protected)/search/page.tsx` or `components/discovery/search-bar.tsx`

### 5c. `shop_detail_viewed` enrichment

Add properties:

- `referrer`: `document.referrer` or a custom `from` URL param
- `session_search_query`: read from `sessionStorage.getItem('last_search_query')` (set by search page on submit)

**Files:** `app/shops/[shopId]/[slug]/shop-detail-client.tsx`

---

## Wave 6: Test Quality

### 6a. Page-level test rewrites

Rewrite page tests for Home, Map, Search, Shop Detail to mock at HTTP boundary:

- Replace `vi.mock('./components/...')` with MSW handlers or `vi.mock('lib/api/fetch')`
- Render full component trees — test that user-visible content appears
- Verify navigation behavior through router mocks

**Files:**

- `app/page.test.tsx`
- `app/map/page.test.tsx`
- `app/(protected)/search/page.test.tsx`
- `app/shops/[shopId]/[slug]/page.test.tsx`

### 6b. Test naming

Rewrite test descriptions to describe user outcomes:

| Before                  | After                                                                    |
| ----------------------- | ------------------------------------------------------------------------ |
| `renders shop cards`    | `Given featured shops, user sees shop names and ratings on home page`    |
| `shows empty state`     | `When search returns no results, user sees suggestion chips to try`      |
| `handles search submit` | `When user submits a search query, they are navigated to search results` |

---

## Wave 7: Performance Validation

Manual verification (no code changes):

- [ ] Mobile-first UI renders correctly at 390px width
- [ ] Desktop breakpoint (≥1024px) shows distinct layout
- [ ] Mapbox lazy-loads (not in initial JS bundle)
- [ ] Core Web Vitals: LCP < 2.5s, CLS < 0.1
- [ ] Glassmorphism fallback works on Android (`@supports` check)

---

## Dependency Chain

```
Wave 1 (backend) → Wave 2 (type cleanup) → Waves 3, 4, 5 (parallel) → Wave 6 (tests) → Wave 7 (perf)
```

---

## Testing Strategy

- **Wave 1 (backend):** Update existing pytest tests for new JSON key casing + new taxonomy_tags shape
- **Wave 3 (components):** TDD — write component tests first for MapDesktopCard and each sub-component
- **Wave 4 (features):** TDD for `useGeolocation` hook, integration test for viewport filtering
- **Wave 5 (analytics):** Verify events fire with correct properties in existing test suites
- **Wave 6:** The wave IS the testing improvement

---

## Out of Scope

- Data pipeline (import, enrichment, embedding) — tracked separately in TODO.md
- Check-in, stamps, reviews, profile pages — separate Phase 2B features
- User lists — separate design doc exists
