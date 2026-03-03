# User Lists — Phase 2A Design

Date: 2026-03-03
Status: Approved

## Overview

User Lists lets authenticated users save coffee shops into named collections (max 3 lists per user, private in V1). The backend is fully built. Phase 2A delivers the frontend experience on top of it.

---

## Architecture

### Backend gaps to fill (4 additions)

1. **Enhance `get_by_user`** — JOIN `list_items` to return `items: [{shop_id}]` per list. Shop IDs only — no coordinates (coordinates are a separate, lazy endpoint).
2. **New `GET /lists/pins`** — returns `[{list_id, shop_id, lat, lng}]` for the mini map on the `/lists` page. Fetched lazily only when that page mounts.
3. **New `GET /lists/{list_id}/shops`** + service method `get_list_shops(list_id)` — returns `Shop[]` with full shop data for the list detail page.
4. **New `PATCH /lists/{list_id}`** + service method `rename(list_id, name)` — renames a list.

> **Risk (important):** `GET /lists/{list_id}/shops` and `PATCH /lists/{list_id}` must include explicit ownership checks in the service layer. RLS handles data access but the service must raise a `ValueError` (→ HTTP 403) if the authenticated user does not own the requested list. This must also be covered by tests (see Testing Strategy).

### Frontend API proxies to add (3 new routes)

- `GET /api/lists/[listId]/shops` → `GET /lists/{list_id}/shops`
- `PATCH /api/lists/[listId]` → `PATCH /lists/{list_id}`
- `GET /api/lists/pins` → `GET /lists/pins`

### Frontend components and pages (7 new files)

| File                                      | Purpose                                                    |
| ----------------------------------------- | ---------------------------------------------------------- |
| `lib/hooks/use-user-lists.ts`             | Central SWR hook — list state, derived maps, all mutations |
| `components/shops/bookmark-button.tsx`    | Bookmark icon with filled/empty saved state                |
| `components/lists/save-to-list-sheet.tsx` | Bottom sheet (vaul Drawer) for saving to lists             |
| `components/lists/rename-list-dialog.tsx` | Rename dialog with pre-filled input                        |
| `components/lists/list-card.tsx`          | List card shown on the `/lists` index page                 |
| `app/(protected)/lists/page.tsx`          | Overwrite scaffold — mini map + list cards                 |
| `app/(protected)/lists/[listId]/page.tsx` | New route — split map + shop list                          |

---

## Components & Data Flow

### `useUserLists()` hook

SWR key: `/api/lists`

```
lists: [{ id, name, items: [{shop_id}] }]

// Derived state (computed from lists, no extra fetches)
savedShopIds: Set<shopId>                   → isSaved(shopId): boolean
listMembership: Map<listId, Set<shopId>>    → isInList(listId, shopId): boolean

// Mutations (all with optimistic updates + SWR revalidation)
saveShop(listId, shopId)
removeShop(listId, shopId)
createList(name)
deleteList(listId)
renameList(listId, name)   // optimistic update patches cache `name` field directly
```

`savedShopIds` drives the `BookmarkButton` filled state everywhere in the app.
`listMembership` drives the per-list checkbox state in `SaveToListSheet`.
Both are O(1) lookups — no per-render array scans.

> **Risk (important):** Rapid toggling (save → remove before first call settles) can desync cache on rollback. Mutations touching the same `(listId, shopId)` pair must be serialized. SWR's optimistic rollback restores the last known server state, not a safe intermediate, so fire-and-forget concurrent mutations on the same pair are unsafe.

### Entry points for saving a shop

Bookmark icon appears in two places:

- **Shop cards** in directory and search results
- **Shop detail page**

Both render `<BookmarkButton shopId={id} />` which reads `isSaved(shopId)` from the hook.

### Save interaction — bottom sheet

Tapping the bookmark icon (when authenticated) opens `SaveToListSheet`:

```
┌─────────────────────────────┐
│ ━━━  (drag handle)          │
│                             │
│  Save to list               │
│                             │
│  ☑  Work spots       (12)  │
│  ☐  Date night        (5)  │
│  ☐  Weekend vibes     (8)  │
│                             │
│  ＋ Create new list  (hidden when 3 lists)
│                             │
│  [ Done ]                   │
└─────────────────────────────┘
```

Checkbox state: `isInList(listId, shopId)`.
Checkbox toggle: calls `saveShop` or `removeShop`.
"+ Create new list": inline form, hidden when `lists.length === 3`.

If unauthenticated: redirect to `/login?next=/shops/{id}`.

### `/lists` page

```
┌───────────────────────────┐
│  My Lists          (2/3)  │
│                           │
│  [ mini Mapbox map        │  ← lazy GET /api/lists/pins
│    pins colored by list ] │    3 distinct colors (max 3 lists)
│                           │
│  ┌─────────────────────┐  │
│  │ Work spots  12 shops│  │  ← list-card.tsx
│  └─────────────────────┘  │    desktop: ✎ 🗑 on hover
│  ┌─────────────────────┐  │    mobile: ⋯ menu button
│  │ Date night   5 shops│  │    (long-press avoided due to
│  └─────────────────────┘  │     iOS Safari unreliability)
│                           │
│  [ + Create new list ]    │  ← hidden when lists.length === 3
└───────────────────────────┘
```

> **Risk (important):** Long-press on iOS Safari is unreliable — the browser hijacks the gesture for text selection and native context menus. The design uses a `⋯` menu button on touch devices (`@media (pointer: coarse)`) instead. If a library-based long-press is used in a future iteration, `react-use-long-press` is the recommended choice.

### `/lists/[listId]` page — split map + shop list

```
hoveredShopId: string | null  (local state, lifted to page)

┌─────────────────────────────────────┐
│  ← Work spots    ✎  🗑  (desktop)  │
│                                     │
│  ┌──────────────────────────────┐   │
│  │  Mapbox map                  │   │
│  │  highlightedShopId → larger  │   │
│  │  marker + accent color       │   │
│  │  onPinClick → setHovered +   │   │
│  │  scroll list to card         │   │
│  └──────────────────────────────┘   │
│                                     │
│  ┌──────────────────────────────┐   │
│  │ ☕ Cafe Lulu                  │   │
│  │ ★ 4.2 · Da'an · WiFi  [✕]  │   │ ← onMouseEnter → setHovered (desktop)
│  └──────────────────────────────┘   │   onTap → setHovered + pan map (mobile)
│  ┌──────────────────────────────┐   │
│  │ ☕ Simple Kaffa               │   │
│  │ ★ 4.5 · Zhongshan     [✕]  │   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

Mapbox with zero pins: explicit `fitBounds` fallback (Taiwan bounding box) to prevent viewport error.
Empty state (no shops): "No shops saved yet — go explore!"

---

## Error Handling

| Scenario                            | Behavior                                                                                                               |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 3-list cap hit (API 400)            | Toast: "You've reached the 3-list limit"                                                                               |
| Optimistic update fails             | SWR rollback to last server state + error toast                                                                        |
| Rename to empty name                | Client validation — submit disabled                                                                                    |
| Delete list                         | Confirmation dialog: "Delete 'Work spots'? This won't remove the shops."                                               |
| Unauthenticated bookmark tap        | Redirect to `/login?next=/shops/{id}`                                                                                  |
| Map with zero pins                  | Empty bounds fallback, no Mapbox viewport error                                                                        |
| Shop deleted but still in list item | Join silently drops stale item; list card count may differ from detail count. Accepted for V1 — not worth complex fix. |

---

## Testing Strategy

### `lib/hooks/use-user-lists.ts` (Vitest + MSW + `renderHook`)

- `isSaved(shopId)` returns true for a shop in any list, false otherwise
- `isInList(listId, shopId)` returns correct per-list state
- `saveShop` optimistically adds to cache; rolls back and shows error on network failure
- `removeShop` optimistically removes; rolls back on failure
- `renameList` optimistically updates `name` field in SWR cache
- Rapid toggle (save → remove before first settles): second mutation waits; rollback restores server state
- `createList` triggers cap error toast when 3 lists exist

### `components/lists/save-to-list-sheet.tsx`

- Checkbox is checked for lists that already contain the shop (`isInList`)
- Checkbox toggle calls `saveShop` / `removeShop`
- "+ Create new list" is hidden when `lists.length === 3`
- Inline create form submits and reflects new list in checkbox list

### `components/shops/bookmark-button.tsx`

- Renders filled icon when `isSaved(shopId) = true`
- Opens `SaveToListSheet` when authenticated
- Redirects to `/login?next=...` when not authenticated

### `app/(protected)/lists/page.tsx`

- Renders list cards from `useUserLists()`
- Shows `(3/3)` and hides create button when at cap
- Shows empty state when no lists
- Mini map pins NOT fetched on cold load (lazy on mount)

### `app/(protected)/lists/[listId]/page.tsx`

- Hover on shop card: `hoveredShopId` set and passed to map as `highlightedShopId`
- Pin click: list scrolls to matching card
- Last shop removed: empty state shown
- Navigating to a `listId` that belongs to another user: API returns 403

### Backend additions (pytest)

- `GET /lists/` returns `items: [{shop_id}]` per list
- `GET /lists/pins` returns `[{list_id, shop_id, lat, lng}]` for all user's lists
- `GET /lists/{list_id}/shops` returns correct `Shop[]`
- `GET /lists/{list_id}/shops` with another user's `list_id` → 403
- `PATCH /lists/{list_id}` renames successfully
- `PATCH /lists/{list_id}` with another user's `list_id` → 403

---

## Out of Scope (V1)

- Shareable list links (SPEC §Business Rules: "Lists are private in V1")
- List reordering
- Duplicate shop detection across lists (intentionally allowed)
- List item ordering (sorted by `added_at` desc, not configurable)
