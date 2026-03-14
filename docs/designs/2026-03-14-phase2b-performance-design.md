# Phase 2B Performance Audit & Fixes — Design Doc

Date: 2026-03-14

## Context

Phase 2B TODO lists 5 performance items. Audit reveals most are already implemented:

| Item                                            | Status   | Action                                 |
| ----------------------------------------------- | -------- | -------------------------------------- |
| Mobile-first UI (390px default)                 | Done     | Verify                                 |
| Desktop breakpoint ≥1024px                      | Done     | Verify                                 |
| Map: lazy-load, viewport pins, static thumbnail | Done     | Add list-view toggle                   |
| Core Web Vitals: LCP < 2.5s, CLS < 0.1          | Not done | Enable Sentry CWV + image optimization |
| `backdrop-filter` fallback for Android          | Done     | Verify                                 |

This design covers the 4 remaining changes plus verification.

---

## 1. Core Web Vitals via Sentry

**Problem:** No CWV measurement exists. Can't validate LCP/CLS/INP targets.

**Solution:** Enable `tracesSampleRate` in `sentry.client.config.ts` (0.1 in production). Sentry's `@sentry/nextjs` SDK automatically captures LCP, CLS, FID, INP, and TTFB when tracing is active.

**Target thresholds** (documented, not runtime-enforced):

- LCP < 2.5s
- CLS < 0.1
- INP < 200ms

**Files:** `sentry.client.config.ts`

**Trade-offs:**

- +: Zero new dependencies, appears in Sentry Performance → Web Vitals dashboard
- −: ~1-2% overhead per request from tracing; mitigated by 10% sample rate

---

## 2. Image `sizes` Optimization

**Problem:** Most `next/image` components use `fill` without `sizes` attributes. Without `sizes`, the browser downloads the largest srcset image regardless of viewport width.

**Solution:** Add responsive `sizes` to all fill-mode Image components:

| Component                 | `sizes` value                                 | Rationale        |
| ------------------------- | --------------------------------------------- | ---------------- |
| `shop-hero.tsx`           | `100vw`                                       | Full-width hero  |
| `shop-card.tsx`           | Already has `(min-width: 1024px) 33vw, 100vw` | No change        |
| `checkin-photo-grid.tsx`  | `(min-width: 1024px) 25vw, 50vw`              | Grid layout      |
| `stamp-passport.tsx`      | `80px`                                        | Fixed-size stamp |
| `checkin-history-tab.tsx` | `64px`                                        | Thumbnail        |
| `profile-header.tsx`      | `96px`                                        | Avatar           |

**Files:** ~5 components

---

## 3. Map List-View Toggle

**Problem:** ASSUMPTIONS.md T4 flags Mapbox GL JS on low-end Android as "low confidence." No fallback exists for users who prefer a list.

**Solution:** Add a toggle button on the map page (map icon ↔ list icon):

- **Map view** (default): Current MapView with Mapbox pins
- **List view**: Vertical scroll of ShopCard components, sorted by distance (if geolocation available) or alphabetical

**Implementation:**

- `useState<'map' | 'list'>('map')` — ephemeral, no URL state
- List view reuses existing `ShopCard` component
- New `MapListView` component (~50 lines)
- Toggle button in the map page header area

**Files:** `app/map/page.tsx`, `components/map/map-list-view.tsx`

**Trade-offs:**

- +: Simple, user-controlled, no device detection heuristics
- −: Users must discover the toggle themselves (but map is the default, so no degradation)

---

## 4. Noto Sans TC Font

**Problem:** App targets Taiwan users but only loads Latin subsets (Geist Sans). Chinese characters fall back to system fonts, causing inconsistent rendering across platforms.

**Solution:** Add Noto Sans TC via `next/font/google`:

- Weights: 400 (regular) + 700 (bold)
- Next.js auto-subsets and self-hosts with optimal cache headers
- Font stack: `var(--font-geist-sans), var(--font-noto-sans-tc), system-ui, sans-serif`

**Files:** `app/layout.tsx`, `app/globals.css` (CSS variable)

**Trade-offs:**

- +: Consistent CJK rendering across all devices; auto-subsetted by Next.js
- −: ~200-400KB additional font download; mitigated by `font-display: swap` and caching

---

## 5. Verification

After implementation, verify all 5 TODO items:

1. **Mobile-first**: Inspect CSS — confirm mobile-default, `md:`/`lg:` overrides
2. **Desktop breakpoint**: Confirm `useIsDesktop()` at 1024px, two layout systems
3. **Map performance**: Confirm lazy-load (`dynamic()`), viewport filtering, static thumbnail, list toggle
4. **CWV**: Run Lighthouse on home, shop detail, map pages
5. **`backdrop-filter`**: Confirm `supports-[not(backdrop-filter)]` fallback in header-nav and map page

---

## Testing Strategy

| Change               | Test approach                                                |
| -------------------- | ------------------------------------------------------------ |
| Map list-view toggle | Unit test: toggle renders list view, toggle back renders map |
| Image sizes          | No test (static attributes)                                  |
| Sentry CWV           | No test (config-only)                                        |
| Noto Sans TC         | No test (visual verification)                                |

---

## Out of Scope

- Auto-detection of low-end devices (decided: user toggle only)
- Bundle splitting optimization (current Turbopack + dynamic imports sufficient)
- CJK font self-hosting (decided: use `next/font/google`)
- CWV reporting to PostHog (decided: Sentry only)
