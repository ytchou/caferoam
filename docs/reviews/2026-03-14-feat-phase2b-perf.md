# Code Review Log: feat/phase2b-perf

**Date:** 2026-03-14
**Branch:** feat/phase2b-perf
**Mode:** Pre-PR

## Pass 1 — Full Discovery

_Agents: Bug Hunter (Opus), Standards (Sonnet), Architecture (Opus), Plan Alignment (Sonnet)_

### Issues Found (7 total, 1 false positive)

| Severity  | File:Line                | Description                                                                                                            | Flagged By               |
| --------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Critical  | profile-header.tsx:25    | `next/image` will throw for non-Supabase avatar URLs (OAuth providers) — `next.config.ts` only allows `**.supabase.co` | Bug Hunter, Architecture |
| Important | map/page.tsx:29          | `useGeolocation()` never calls `requestLocation()` — distance sorting is dead code                                     | Bug Hunter, Architecture |
| Important | map-list-view.tsx:29-33  | Haversine called twice per sort comparison; pre-compute distances (Schwartzian transform)                              | Standards                |
| Minor     | map/page.tsx:67          | Toggle onClick inline closure; use functional update form                                                              | Standards                |
| Minor     | profile-header.tsx:24-30 | `next/image fill` bypasses Radix AvatarImage loading state                                                             | Standards                |
| Minor     | map/page.tsx:23          | selectedShopId state leaks across view mode toggles                                                                    | Bug Hunter               |

### Validation Results

- Skipped (false positive): `layout.tsx:18` — Noto Sans TC `subsets:['latin']` is correct; `subsets` controls preload hints only, CJK characters load on-demand via unicode-range CSS
- Proceeding to fix: 6 valid/debatable issues (1 Critical, 2 Important, 3 Minor)

## Fix Pass 1

**Pre-fix SHA:** d86a0faad319e6da4ae50ae0f40011b93f81318d
**Issues fixed:**

- [Critical] profile-header.tsx:25 — Reverted to `<img>` for OAuth avatar URL compatibility
- [Important] map/page.tsx:29 — Added `requestLocation()` call when toggling to list view
- [Important] map-list-view.tsx:29-33 — Pre-compute distances with Schwartzian transform
- [Minor] map/page.tsx:23 — Clear selectedShopId when toggling to list view

**Issues skipped (debatable, not worth churn):**

- [Minor] profile-header.tsx:24-30 — Radix AvatarImage bypass is pre-existing pattern
- [Minor] map/page.tsx:67 — Inline closure is idiomatic React; functional update form is a style preference

**Batch Test Run:**

- `pnpm test` — PASS (555 tests, 100 files)

## Pass 2 — Re-Verify

_Agents re-run (smart routing): Bug Hunter, Standards, Architecture (combined Sonnet agent)_
_Agents skipped (no findings in previous pass): Plan Alignment_

### Previously Flagged Issues — Resolution Status

- [Critical] profile-header.tsx:25 — Resolved (reverted to `<img>`)
- [Important] map/page.tsx:29 — Resolved (`requestLocation()` called on list toggle)
- [Important] map-list-view.tsx:29-33 — Resolved (Schwartzian transform)
- [Minor] map/page.tsx:23 — Resolved (clear selectedShopId on toggle)

### New Issues Found (0)

None. All fixes verified, no regressions.

## Final State

**Iterations completed:** 1
**All Critical/Important resolved:** Yes
**Remaining issues:**

- [Minor] map/page.tsx:67 — Toggle onClick inline closure (debatable, skipped)
- [Minor] profile-header.tsx:24-30 — Radix AvatarImage bypass (pre-existing, skipped)

**Review log:** docs/reviews/2026-03-14-feat-phase2b-perf.md
