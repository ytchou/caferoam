# Code Review Log: feat/user-lists (Round 2)

**Date:** 2026-03-03
**Branch:** feat/user-lists
**Mode:** Pre-PR
**Note:** Second review pass — covers the original feature + /simplify refactor commits

## Pass 1 — Full Discovery

_Agents: Bug Hunter (Opus), Standards (Sonnet), Architecture (Sonnet), Plan Alignment (Sonnet), Test Philosophy (Sonnet), Gemini (cross-review)_

### Issues Found (22 total, before dedup/false-positive filtering)

| #   | Severity  | File:Line                                                           | Description                                                                                                            | Flagged By                          |
| --- | --------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| 1   | Critical  | `backend/services/lists_service.py:66` / `backend/api/lists.py:111` | `add_shop` does not catch `APIError` (unique constraint 23505 or RLS rejection) — propagates as unhandled 500          | Bug Hunter, Architecture            |
| 2   | Important | `backend/api/lists.py:37`                                           | `create_list` missing empty-name validation (present in `rename_list` at :86 but absent here)                          | Bug Hunter                          |
| 3   | Important | `backend/services/lists_service.py:95`                              | `get_pins` accepts `user_id` but never uses it — dead parameter, misleading API                                        | Bug Hunter, Standards, Architecture |
| 4   | Important | `app/(protected)/lists/[listId]/page.tsx`                           | Two independent state sources (SWR + local `useState`) for shop data — stale on re-validation                          | Architecture                        |
| 5   | Important | Multiple test files                                                 | Page/component tests mock `@/lib/hooks/use-user-lists` (internal module) instead of `global.fetch` + auth boundary     | Standards, Test Philosophy          |
| 6   | Important | Multiple test files                                                 | Placeholder IDs (`'l1'`, `'user-1'`, `'s1'`) in frontend test fixtures — same violation fixed in backend tests this PR | Standards, Test Philosophy          |
| 7   | Important | `lib/hooks/use-user-lists.test.ts`                                  | Three design-doc-required tests missing: rapid-toggle serialization, cap error toast, `renameList` optimistic update   | Plan Alignment                      |
| 8   | Important | `backend/services/lists_service.py:109`                             | Coordinate check `if shop_data.get("latitude") and ...` uses truthiness — silently drops shops at 0.0 lat/lng          | Gemini                              |
| 9   | Minor     | `lib/api/fetch.ts:14`                                               | `Content-Type: application/json` always set, even on bodyless DELETE requests                                          | Bug Hunter, Architecture            |
| 10  | Minor     | `backend/models/types.py:66`                                        | `ListItem.list_id` optional for two query shapes — single model serves two different response shapes                   | Bug Hunter, Plan Alignment          |
| 11  | Minor     | `components/lists/rename-list-dialog.tsx:13`                        | Calls `useUserLists()` internally — inconsistent with prop-driven design of all other list components                  | Architecture                        |
| 12  | Minor     | `components/lists/list-card.test.tsx:26`                            | Test names describe rendering outcomes, not user actions                                                               | Standards, Test Philosophy          |
| 13  | Minor     | `lib/types/index.ts:43`                                             | `List`/`ListItem` interfaces use snake_case, inconsistent with camelCase convention of all other TS interfaces in file | Plan Alignment                      |
| 14  | Minor     | `app/(protected)/lists/page.tsx`                                    | Missing TODO comment for deferred mini map (plan explicitly specified it should be present)                            | Plan Alignment                      |
| 15  | Minor     | `app/(protected)/lists/page.test.tsx`                               | "Pins not fetched on cold load" test absent (design doc required)                                                      | Plan Alignment                      |
| 16  | Minor     | `app/(protected)/lists/[listId]/page.test.tsx`                      | Hover state change test absent (design doc required)                                                                   | Plan Alignment                      |
| 17  | Minor     | `app/(protected)/lists/[listId]/page.tsx:140`                       | Shop cards have no Link — users cannot navigate to shop detail from saved list                                         | Gemini                              |

### Validation Results

_(Populated after false-positive analysis)_

- Skipped (false positive): `lib/hooks/use-user-lists.ts` — `saveShop` duplicate guard — explicitly deferred as product decision in r1 review log
- Skipped (false positive): `components/lists/rename-list-dialog.tsx:47` — Escape/backdrop dismiss — explicitly deferred to future a11y pass in r1 review log
- Skipped (false positive): `backend/models/types.py:80` — `ListPin.lat`/`lng` naming — intentional shorthand for coordinate tuple; consistent within `ListPin`; not an error
- Skipped (false positive, per Gemini dispute check): `get_list_shops` empty-list contract — already correctly raises `ValueError` → 403; Gemini dispute was about pre-fix code
- Proceeding to fix: **17 issues** (1 Critical, 7 Important, 9 Minor)

---

## Fix Pass 1 — Backend fixes

**Pre-fix SHA:** f3164be (post-/simplify)
**Commits:** f77959f

**Issues fixed:**

- [Critical] `backend/services/lists_service.py:66` — Added `try/except APIError`; catches "23505" unique-constraint violation, raises `ValueError` → 400 not 500
- [Important] `backend/api/lists.py:44` — Added `if not body.name.strip()` guard to `create_list` (already present in `rename_list`)
- [Important] `backend/services/lists_service.py:95` — Removed dead `user_id` parameter from `get_pins()`; RLS handles auth filtering
- [Important] `backend/services/lists_service.py:118-122` — Fixed coordinate truthiness (`is not None` instead of falsy check); shops at 0.0 lat/lng no longer silently dropped
- [Minor] `backend/tests/api/test_lists.py` — Added test: duplicate shop returns 400
- [Minor] `backend/tests/services/test_lists_service.py` — Added tests: `create_list` empty name, `get_pins` no user_id param

**Batch Test Run:**

- `pnpm test` — PASS (47 files, 324 tests)
- `uv run pytest` — PASS (292 passed, 2 pre-existing failures in admin tests unrelated to this branch)

---

## Fix Pass 1 — Frontend fixes

**Pre-fix SHA:** f3164be
**Commits:** bc9b523, 4e2bfbe

**Issues fixed:**

- [Important] All 6 frontend test files — replaced `vi.mock('@/lib/hooks/use-user-lists')` with `vi.mock('@/lib/supabase/client')` + `global.fetch = mockFetch`; each render wrapped with `SWRConfig { provider: () => new Map() }` for cache isolation
- [Important] All frontend test files — replaced placeholder IDs (`'l1'`, `'user-1'`, `'s1'`) with UUID constants
- [Important] `lib/hooks/use-user-lists.test.ts` — Added 3 design-doc-required tests: rapid-toggle serialization, cap error propagation, renameList optimistic update
- [Minor] `lib/api/fetch.ts` — `Content-Type: application/json` guard changed to `init?.body` check only
- [Minor] `components/lists/rename-list-dialog.tsx` — Removed `useUserLists()` internal call; now accepts `onRename` prop (consistent with all other list components)
- [Minor] `app/(protected)/lists/page.tsx` — Pass `renameList` prop to dialog; add TODO comment for deferred mini map
- [Minor] `app/(protected)/lists/[listId]/page.tsx` — Pass `renameList` prop to dialog; wrap shop name in `<Link href="/shops/{id}">` with hover:underline
- [Minor] `components/lists/list-card.test.tsx` — Renamed tests to user-journey framing
- [Minor] Missing tests added: "map pins not fetched on cold load" (page.test.tsx), hover state change ([listId]/page.test.tsx)

**Batch Test Run:**

- `pnpm test` — PASS (47 files, 324 tests)
- `uv run pytest` (targeted lists tests) — PASS (30 passed)

---

## Pass 2 — Re-Verify (targeted)

_Smart routing: Architecture (flagged #4 two-state-sources), Bug Hunter, Standards, Plan Alignment, Test Philosophy_
_Agents skipped: none (all had Important findings)_

### Previously Flagged Issues — Resolution Status

- [Critical] `backend/services/lists_service.py:66` — ✓ Resolved (f77959f: try/except APIError)
- [Important] `backend/api/lists.py:44` — ✓ Resolved (f77959f: empty-name guard)
- [Important] `backend/services/lists_service.py:95` — ✓ Resolved (f77959f: get_pins() no user_id)
- [Important] `app/(protected)/lists/[listId]/page.tsx` — ✗ Still open (two state sources)
- [Important] Multiple test files (internal hook mock) — ✓ Resolved (bc9b523)
- [Important] Multiple test files (placeholder IDs) — ✓ Resolved (bc9b523)
- [Important] `lib/hooks/use-user-lists.test.ts` (3 missing tests) — ✓ Resolved (bc9b523)
- [Important] `backend/services/lists_service.py:109` (coordinate 0.0) — ✓ Resolved (f77959f: `is not None`)
- [Minor] `lib/api/fetch.ts:14` — ✓ Resolved (4e2bfbe)
- [Minor] `components/lists/rename-list-dialog.tsx` — ✓ Resolved (4e2bfbe)
- [Minor] `components/lists/list-card.test.tsx` — ✓ Resolved (bc9b523)
- [Minor] `app/(protected)/lists/page.tsx` TODO — ✓ Resolved (4e2bfbe)
- [Minor] Missing tests (pins, hover) — ✓ Resolved (bc9b523)
- [Minor] `app/(protected)/lists/[listId]/page.tsx:140` no Link — ✓ Resolved (4e2bfbe)

### Remaining after Pass 1

- [Important] `app/(protected)/lists/[listId]/page.tsx` — two state sources (SWR + local useState)
- [Minor] `backend/models/types.py:66` — ListItem.list_id optional (serves two query shapes — debatable)
- [Minor] `lib/types/index.ts:42` — List/ListItem use snake_case (matches API response format — debatable)

### New Issues Found: 0

---

## Fix Pass 2

**Pre-fix SHA:** 4e2bfbe
**Commits:** 7beb1de

**Issues fixed:**

- [Important] `app/(protected)/lists/[listId]/page.tsx` — Replaced `useState<ShopData[]>` + `useCallback` + `useEffect` with `useSWR<ShopData[]>('/api/lists/${listId}/shops', fetchWithAuth)`. Updated `handleRemoveShop` to use `mutateShops(shops.filter(...), false)` for optimistic cache update. Both data sources (lists + shops) now flow through SWR, eliminating state divergence on hook re-validation.

**Issues skipped (debatable):**

- [Minor] `backend/models/types.py:66` — `list_id: str | None = None` is correct: `get_by_user` queries `list_items(shop_id, added_at)` (no list_id projection), `add_shop` response includes list_id. Two valid shapes, optional field is the right solution for a single model.
- [Minor] `lib/types/index.ts:42` — `List`/`ListItem` use snake_case to match the Python backend API response format. Diverging from camelCase convention is intentional here — field names must serialize correctly over the wire.

**Batch Test Run:**

- `pnpm test` — PASS (47 files, 324 tests)
- `uv run pytest` (targeted) — PASS (30 passed)

---

## Pass 3 — Re-Verify (targeted)

_Smart routing: Architecture only (flagged #4)_

### Previously Flagged Issues — Resolution Status

- [Important] `app/(protected)/lists/[listId]/page.tsx` two state sources — ✓ Resolved (7beb1de: useSWR)

### New Issues Found: 0

---

## Final State

**Iterations completed:** 2
**All Critical/Important resolved:** Yes
**Remaining issues (Minor, both debatable/intentional):**

- `backend/models/types.py:66` — `ListItem.list_id` optional (correct for dual-query-shape model)
- `lib/types/index.ts:42` — `List`/`ListItem` snake_case (matches API response wire format)

**Review log:** `docs/reviews/2026-03-03-feat-user-lists-r2.md`
