# Phase 2B: Shop Discovery & Search UI — Design

Date: 2026-03-13

> **UX Reference:** Approved mockups in `docs/designs/ux/screenshots/`. Design handoff in `docs/designs/ux/DESIGN_HANDOFF.md`. Personas in `docs/designs/ux/personas.md`, journeys in `docs/designs/ux/journeys.md`, metrics in `docs/designs/ux/metrics.md`.

---

## Overview

Phase 2B builds the core discovery experience. Covers: Home (search hero + featured shops), Map (Mapbox with pins), Shop Detail (SSR for social sharing), and Semantic Search (auth-gated AI search).

**Key architectural decisions:**
- URL-driven search state shared across tabs (`?q=...&mode=...&filters=...`)
- SSR for Shop Detail (SEO + social previews), CSR for interactive pages (Map, Search)
- SEO-friendly shop URLs with slugs (`/shops/[shopId]/[slug]`)
- Bottom sheet (vaul Drawer) for expanded mobile filters
- Mobile bottom nav + desktop header nav (two distinct layouts, not responsive breakpoints)

---

## Route Structure

| Route | Auth | Rendering | Purpose |
|-------|------|-----------|---------|
| `/` | No | SSR (static) | Home — search hero + featured shops |
| `/map` | No | CSR | Map view — Mapbox + shop pins |
| `/shops/[shopId]/[slug]` | No | SSR | Shop detail — SEO + og:image social preview |
| `/search` | Yes | CSR | Search results (redirect target from Home/Map search) |

Shared search state lives in URL params and persists across tabs via a `useSearchState` hook.

### Navigation

**Mobile (< 1024px):** Persistent bottom nav — Home / Map / Lists / Profile

**Desktop (>= 1024px):** Top header nav — Logo (left) / Search bar (center) / Map + Lists links / Avatar or Login (right)

Two distinct layout systems, not CSS media queries.

---

## Components

### Shared

**`SearchBar`** — AI search input with sparkle icon, >=48px height. Placeholder: "找間有巴斯克蛋糕的咖啡廳…". Accepts `onSubmit`, `defaultQuery` from URL params. Autofocus on desktop Home.

**`SuggestionChips`** — Horizontal scroll of 4 chips (巴斯克蛋糕 / 適合工作 / 安靜一點 / 我附近). Tapping pre-fills SearchBar. "我附近" triggers geolocation. Resets after search submission.

**`ModeChips`** — 4 semantic toggles: 工作 / 放鬆 / 社交 / 精品. Single-select, optional. Stored in URL `?mode=work`. Re-ranks results, not hard filter.

**`FilterPills`** — Persistent row: 距離 / 現正營業 / 有插座 / 評分 / 篩選. Last pill opens FilterSheet. Active state styling. Stored in URL `?filters=outlet,wifi`.

**`FilterSheet`** — Mobile: vaul Drawer (consistent with save-to-list). Desktop: popover. Sections by taxonomy dimension. Checkboxes per tag (label_zh). Apply / Clear buttons.

**`BottomNav`** — Mobile-only. 4 tabs with terracotta active indicator. Above `safe-area-inset-bottom`.

**`HeaderNav`** — Desktop-only. Logo / Search / Nav links / Avatar or Login. Glassmorphism on Map page, solid elsewhere.

**`ShopCard`** — Photo thumbnail, name, rating, neighborhood, 2-3 attribute chips. Navigates to `/shops/[id]/[slug]`.

### Home Page

**`FeaturedGrid`** — 3-column grid (desktop) / vertical scroll (mobile) of ShopCards. Fetches `GET /api/shops?featured=true&limit=12` server-side.

### Map Page

**`MapView`** — react-map-gl with warm Mapbox style, terracotta pins (#E06B3F), viewport-only markers. `dynamic(() => import('./MapView'), { ssr: false })`.

**`MapMiniCard`** — Mobile floating bottom card on pin select. Name, rating, Open badge, distance. Max 30% viewport height. Tap → shop detail, swipe → dismiss.

**`MapDesktopCard`** — Desktop bottom-left floating card (~340px). Photo thumbnails + identity + "View Details" / "Check In" buttons. "List View" toggle bottom-right (`?view=list`).

### Shop Detail Page

**`ShopHero`** — Mobile: single tappable hero photo. Desktop: 3-image carousel (16:9, arrows + dots). `priority` on first image for LCP.

**`ShopIdentity`** — Name, star rating, Open badge, neighborhood/MRT.

**`AttributeChips`** — Read-only taxonomy tag chips.

**`ShopDescription`** — 2-line curated description with "Read more" expand.

**`MenuHighlights`** — Up to 3 items with emoji + price.

**`RecentCheckinsStrip`** — Auth-gated: unauthenticated sees count + one preview photo; authenticated sees full horizontal photo scroll with @username + date.

**`ShopMapThumbnail`** — Mobile: static Mapbox image API (~5KB). Desktop: interactive embed in sticky right column.

**`StickyCheckInBar`** — Mobile: sticky bottom "打卡記錄 Check In →". Desktop: full-width in sticky right column. Unauth click → `/login?returnTo=...`. Above `safe-area-inset-bottom`.

**`ShareButton`** — Native Web Share API + clipboard fallback. Fires `shop_url_copied` PostHog event.

---

## Data Flow

### Home (SSR + CSR hybrid)
1. Server component fetches featured shops (`GET /shops?featured=true&limit=12`)
2. SearchBar/SuggestionChips/ModeChips are client components
3. Search submission: authenticated → `/map?q=...&mode=...`; unauthenticated → `/login?returnTo=/map?q=...`

### Map (CSR)
1. `useShops` SWR hook fetches shops by viewport bounds + active URL param filters
2. Pin click → selected shop ID → MapMiniCard/MapDesktopCard
3. Search/filter changes → URL param update → SWR refetch

### Shop Detail (SSR)
1. Server fetch `GET /shops/{shopId}` at request time
2. `<head>` meta: `og:title`, `og:image`, `og:description`
3. Slug mismatch → 301 redirect to canonical
4. Client islands: ReviewsSection, RecentCheckinsStrip (auth-gated), BookmarkButton, ShareButton

### Search (CSR, auth-gated)
1. `useSearch` SWR hook → `POST /api/search` with `{ query, mode, filters, limit: 20 }`
2. Results as list of ShopCards
3. `query_type` classified server-side only

---

## Responsive Layout

**Breakpoint:** 1024px — two distinct component trees, not CSS scaling.

| Screen | Mobile | Desktop |
|--------|--------|---------|
| Home | Terracotta hero + search + chips + vertical card scroll | Centered search hero + 3-column grid |
| Map | Full-bleed map + glassmorphism overlay + bottom mini card | Full-viewport map + floating glass header + bottom-left card |
| Shop Detail | Single-column scroll + sticky bottom CTA | 2-column: left scrollable, right sticky (carousel + map + CTA) |

---

## Error Handling

- Map fails: "Map unavailable" + list view link. Don't block page.
- Search 0 results: Empty state with SuggestionChips.
- Shop 404: "Shop not found" + Home link.
- Auth gate: Toast "請先登入以使用搜尋功能" + redirect.
- Geolocation denied: "我附近" silently skips location filter.

---

## Performance

- Mapbox lazy-load: `dynamic(..., { ssr: false })` — no map JS in initial bundle
- Viewport-only pins via `onViewportChange`
- Static Mapbox image on mobile shop detail (~5KB vs ~200KB JS)
- All photos via `next/image` with `sizes` prop
- Shop detail hero: `priority` for LCP < 2.5s
- Explicit dimensions on all images + map container for CLS < 0.1
- Glassmorphism: `@supports (backdrop-filter: blur(12px))` with `bg-white/90` fallback

---

## Analytics

| Event | Component | Properties |
|-------|-----------|------------|
| `search_submitted` | SearchBar | `query_text`, `query_type` (server), `mode_chip_active`, `result_count` |
| `shop_detail_viewed` | ShopDetail page | `shop_id`, `referrer`, `session_search_query` |
| `shop_url_copied` | ShareButton | `shop_id`, `copy_method` |
| `filter_applied` | FilterPills/FilterSheet | `filter_type`, `filter_value` |

`query_type` classified server-side — frontend never sees the classification.

---

## Testing Strategy

**Component tests:** SearchBar (submit, chip pre-fill), ModeChips (toggle, URL sync), FilterSheet (multi-select, apply/clear), ShopCard (render, navigate), BottomNav (active tab), ShareButton (share API + analytics).

**Page tests:** Home (search bar + featured shops, submit → navigate), Shop Detail (renders public info, auth-gated sections hidden for unauth). Map page tests deferred to post-data-gate.

**Hook tests:** `useShops` (fetch by filters, empty/error), `useSearch` (query, auth error).

---

## Slug Generation

Slugs from shop name: Chinese → pinyin, spaces/specials → hyphens, lowercase, max 60 chars. Stored in `shops.slug` column (requires DB migration). Slug mismatch → 301 redirect to canonical.
