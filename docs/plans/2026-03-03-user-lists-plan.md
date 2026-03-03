# User Lists (Phase 2A) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Design Doc:** [docs/designs/2026-03-03-user-lists-design.md](../designs/2026-03-03-user-lists-design.md)

**Spec References:** [SPEC.md §Business Rules](../../SPEC.md) — lists cap, lists private in V1, auth wall

**PRD References:** [PRD.md §Core Features](../../PRD.md) — "User lists — max 3 lists per user, unlimited locations per list (private in V1)"

**Goal:** Build the complete frontend experience for User Lists — save shops to named collections, manage lists, browse list contents on a split map+list view — on top of the existing backend.

**Architecture:** SWR-based `useUserLists()` hook provides centralized list state with derived `savedShopIds` Set and `listMembership` Map. Backend gets 4 additions: enhanced `get_by_user` with items, `GET /lists/pins`, `GET /lists/{list_id}/shops`, `PATCH /lists/{list_id}`. Frontend uses vaul Drawer for save interaction, Mapbox GL JS for map views.

**Tech Stack:** SWR (new dep), vaul (new dep), react-map-gl + mapbox-gl (new deps), sonner (existing), lucide-react (existing), Tailwind + shadcn patterns (existing)

**Acceptance Criteria:**
- [ ] A user can tap a bookmark icon on a shop card and save/unsave the shop to any of their lists via a bottom sheet
- [ ] A user can visit /lists and see all their lists with a mini map showing pins for all saved shops
- [ ] A user can tap into a list and see a split map+shop-list view where hovering a card highlights its pin
- [ ] A user cannot create more than 3 lists — the UI shows the cap and the API enforces it
- [ ] An unauthenticated user who taps the bookmark icon is redirected to the login page

---

## Task 1: Install new frontend dependencies

**Files:**
- Modify: `package.json`

**Step 1: Install SWR, vaul, react-map-gl, mapbox-gl**

No test needed — dependency installation only.

```bash
pnpm add swr vaul react-map-gl mapbox-gl
pnpm add -D @types/mapbox-gl
```

**Step 2: Verify installation**

Run: `pnpm build --no-lint` (dry run to ensure no conflicts)

**Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "chore: add swr, vaul, react-map-gl, mapbox-gl deps for lists feature"
```

---

## Task 2: Backend — Enhance `get_by_user` to include list items

**Files:**
- Modify: `backend/services/lists_service.py:14-23`
- Modify: `backend/models/types.py:57-62`
- Test: `backend/tests/services/test_lists_service.py`

**API Contract:**
```yaml
endpoint: GET /lists
response: # enhanced — now includes items
  - id: string
    user_id: string
    name: string
    created_at: datetime
    updated_at: datetime
    items:
      - shop_id: string
        added_at: datetime
```

**Step 1: Write the failing test**

Add to `backend/tests/services/test_lists_service.py`:

```python
async def test_get_by_user_includes_items(self, lists_service, mock_supabase):
    """get_by_user() must return lists with their items (shop_ids)."""
    mock_supabase.table = MagicMock(
        return_value=MagicMock(
            select=MagicMock(
                return_value=MagicMock(
                    eq=MagicMock(
                        return_value=MagicMock(
                            order=MagicMock(
                                return_value=MagicMock(
                                    execute=MagicMock(
                                        return_value=MagicMock(
                                            data=[
                                                {
                                                    "id": "l1",
                                                    "user_id": "user-1",
                                                    "name": "Work spots",
                                                    "created_at": datetime.now().isoformat(),
                                                    "updated_at": datetime.now().isoformat(),
                                                    "list_items": [
                                                        {
                                                            "shop_id": "s1",
                                                            "added_at": datetime.now().isoformat(),
                                                        },
                                                        {
                                                            "shop_id": "s2",
                                                            "added_at": datetime.now().isoformat(),
                                                        },
                                                    ],
                                                }
                                            ]
                                        )
                                    )
                                )
                            )
                        )
                    )
                )
            )
        )
    )
    results = await lists_service.get_by_user("user-1")
    assert len(results) == 1
    assert len(results[0].items) == 2
    assert results[0].items[0].shop_id == "s1"
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/test_lists_service.py::TestListsService::test_get_by_user_includes_items -v`
Expected: FAIL — `List` model has no `items` field

**Step 3: Write minimal implementation**

In `backend/models/types.py`, add `items` to `List`:

```python
class ListWithItems(BaseModel):
    id: str
    user_id: str
    name: str
    created_at: datetime
    updated_at: datetime
    items: list[ListItem] = []
```

In `backend/services/lists_service.py`, update `get_by_user` to use PostgREST's nested select:

```python
async def get_by_user(self, user_id: str) -> list[ListWithItems]:
    response = (
        self._db.table("lists")
        .select("*, list_items(shop_id, added_at)")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    results = []
    for row in rows:
        items_data = row.pop("list_items", [])
        items = [ListItem(**item) for item in items_data]
        results.append(ListWithItems(**row, items=items))
    return results
```

Update the import in `backend/api/lists.py` if needed (the route already calls `.model_dump()` on results, so the new `items` field will serialize automatically).

**Step 4: Run test to verify it passes**

Run: `cd backend && python -m pytest tests/services/test_lists_service.py::TestListsService::test_get_by_user_includes_items -v`
Expected: PASS

Also run all existing tests to make sure nothing broke:
Run: `cd backend && python -m pytest tests/services/test_lists_service.py -v`
Expected: All PASS (existing test uses `select("*")` mock — update mock's select arg to match `"*, list_items(shop_id, added_at)"` if needed)

**Step 5: Commit**

```bash
cd backend && git add models/types.py services/lists_service.py tests/services/test_lists_service.py
git commit -m "feat(lists): get_by_user returns items with shop_ids via nested select"
```

---

## Task 3: Backend — Add `GET /lists/pins` endpoint

**Files:**
- Modify: `backend/services/lists_service.py`
- Modify: `backend/api/lists.py`
- Modify: `backend/models/types.py`
- Test: `backend/tests/services/test_lists_service.py`
- Test: `backend/tests/api/test_lists.py`

**API Contract:**
```yaml
endpoint: GET /lists/pins
response:
  - list_id: string
    shop_id: string
    lat: float
    lng: float
errors:
  401: unauthenticated
```

**Step 1: Write the failing service test**

Add to `backend/tests/services/test_lists_service.py`:

```python
async def test_get_pins_returns_coordinates(self, lists_service, mock_supabase):
    """get_pins() returns list_id, shop_id, lat, lng for all saved shops."""
    mock_supabase.rpc = MagicMock(
        return_value=MagicMock(
            execute=MagicMock(
                return_value=MagicMock(
                    data=[
                        {"list_id": "l1", "shop_id": "s1", "lat": 25.04, "lng": 121.52},
                        {"list_id": "l1", "shop_id": "s2", "lat": 25.05, "lng": 121.53},
                    ]
                )
            )
        )
    )
    results = await lists_service.get_pins("user-1")
    assert len(results) == 2
    assert results[0].lat == 25.04
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/test_lists_service.py::TestListsService::test_get_pins_returns_coordinates -v`
Expected: FAIL — `get_pins` not defined

**Step 3: Write minimal implementation**

Add `ListPin` model to `backend/models/types.py`:

```python
class ListPin(BaseModel):
    list_id: str
    shop_id: str
    lat: float
    lng: float
```

Add `get_pins` to `backend/services/lists_service.py`:

```python
async def get_pins(self, user_id: str) -> list[ListPin]:
    """Return coordinates for all shops across the user's lists.
    Uses a join query: list_items → shops for lat/lng.
    """
    response = (
        self._db.table("list_items")
        .select("list_id, shop_id, shops(latitude, longitude)")
        .execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    pins = []
    for row in rows:
        shop_data = row.get("shops", {})
        if shop_data and shop_data.get("latitude") and shop_data.get("longitude"):
            pins.append(
                ListPin(
                    list_id=row["list_id"],
                    shop_id=row["shop_id"],
                    lat=shop_data["latitude"],
                    lng=shop_data["longitude"],
                )
            )
    return pins
```

Note: RLS on `list_items` already filters to the authenticated user's lists via the JOIN policy.

Add route to `backend/api/lists.py`:

```python
@router.get("/pins")
async def get_list_pins(
    user: dict[str, Any] = Depends(get_current_user),
    db: Client = Depends(get_user_db),
) -> list[dict[str, Any]]:
    """Get map pins (coordinates) for all shops in the user's lists."""
    service = ListsService(db=db)
    results = await service.get_pins(user["id"])
    return [r.model_dump() for r in results]
```

**Important:** The `/pins` route MUST be registered before `/{list_id}` routes in the router, otherwise FastAPI will match "pins" as a `list_id` path parameter. Place it right after `POST /`.

**Step 4: Run tests**

Run: `cd backend && python -m pytest tests/services/test_lists_service.py::TestListsService::test_get_pins_returns_coordinates tests/api/test_lists.py -v`
Expected: All PASS

**Step 5: Write the failing API test and make it pass**

Add to `backend/tests/api/test_lists.py`:

```python
def test_get_pins_requires_auth(self):
    response = client.get("/lists/pins")
    assert response.status_code == 401
```

Run: `cd backend && python -m pytest tests/api/test_lists.py::TestListsAPI::test_get_pins_requires_auth -v`
Expected: PASS (route inherits auth from dependency)

**Step 6: Commit**

```bash
cd backend && git add models/types.py services/lists_service.py api/lists.py tests/services/test_lists_service.py tests/api/test_lists.py
git commit -m "feat(lists): add GET /lists/pins endpoint for map coordinates"
```

---

## Task 4: Backend — Add `GET /lists/{list_id}/shops` endpoint

**Files:**
- Modify: `backend/services/lists_service.py`
- Modify: `backend/api/lists.py`
- Test: `backend/tests/services/test_lists_service.py`
- Test: `backend/tests/api/test_lists.py`

**API Contract:**
```yaml
endpoint: GET /lists/{list_id}/shops
response:
  - id: string
    name: string
    address: string
    latitude: float
    longitude: float
    rating: float | null
    review_count: int
    # ... full Shop fields
errors:
  401: unauthenticated
  403: list not owned by user (RLS returns empty)
```

**Step 1: Write the failing service test**

Add to `backend/tests/services/test_lists_service.py`:

```python
async def test_get_list_shops_returns_full_shop_data(self, lists_service, mock_supabase):
    """get_list_shops() returns full Shop objects for shops in a list."""
    mock_supabase.table = MagicMock(
        return_value=MagicMock(
            select=MagicMock(
                return_value=MagicMock(
                    eq=MagicMock(
                        return_value=MagicMock(
                            execute=MagicMock(
                                return_value=MagicMock(
                                    data=[
                                        {
                                            "shop_id": "s1",
                                            "added_at": datetime.now().isoformat(),
                                            "shops": {
                                                "id": "s1",
                                                "name": "山小孩咖啡",
                                                "address": "台北市大安區溫州街74巷5弄2號",
                                                "latitude": 25.0216,
                                                "longitude": 121.5312,
                                                "mrt": "台電大樓",
                                                "phone": None,
                                                "website": None,
                                                "opening_hours": None,
                                                "rating": 4.6,
                                                "review_count": 287,
                                                "price_range": "$$",
                                                "description": "安靜適合工作",
                                                "photo_urls": [],
                                                "menu_url": None,
                                                "taxonomy_tags": [],
                                                "mode_scores": None,
                                                "cafenomad_id": None,
                                                "google_place_id": None,
                                                "created_at": datetime.now().isoformat(),
                                                "updated_at": datetime.now().isoformat(),
                                            },
                                        }
                                    ]
                                )
                            )
                        )
                    )
                )
            )
        )
    )
    results = await lists_service.get_list_shops(list_id="l1")
    assert len(results) == 1
    assert results[0].name == "山小孩咖啡"
    assert results[0].latitude == 25.0216

async def test_get_list_shops_empty_when_unauthorized(self, lists_service, mock_supabase):
    """get_list_shops() returns empty list when RLS blocks access (user doesn't own list)."""
    mock_supabase.table = MagicMock(
        return_value=MagicMock(
            select=MagicMock(
                return_value=MagicMock(
                    eq=MagicMock(
                        return_value=MagicMock(
                            execute=MagicMock(
                                return_value=MagicMock(data=[])
                            )
                        )
                    )
                )
            )
        )
    )
    results = await lists_service.get_list_shops(list_id="l1")
    assert results == []
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/test_lists_service.py::TestListsService::test_get_list_shops_returns_full_shop_data -v`
Expected: FAIL — `get_list_shops` not defined

**Step 3: Write minimal implementation**

Add to `backend/services/lists_service.py`:

```python
async def get_list_shops(self, list_id: str) -> list[Shop]:
    """Get full shop data for all shops in a list.
    RLS on list_items ensures only the owner's lists are visible.
    """
    response = (
        self._db.table("list_items")
        .select("shop_id, added_at, shops(*)")
        .eq("list_id", list_id)
        .execute()
    )
    rows = cast("list[dict[str, Any]]", response.data)
    shops = []
    for row in rows:
        shop_data = row.get("shops")
        if shop_data:
            shops.append(Shop(**shop_data))
    return shops
```

Add route to `backend/api/lists.py`:

```python
@router.get("/{list_id}/shops")
async def get_list_shops(
    list_id: str,
    user: dict[str, Any] = Depends(get_current_user),
    db: Client = Depends(get_user_db),
) -> list[dict[str, Any]]:
    """Get full shop data for shops in a list. Auth required."""
    service = ListsService(db=db)
    results = await service.get_list_shops(list_id=list_id)
    return [r.model_dump() for r in results]
```

**Step 4: Run tests**

Run: `cd backend && python -m pytest tests/services/test_lists_service.py -v`
Expected: All PASS

**Step 5: Add API test**

Add to `backend/tests/api/test_lists.py`:

```python
def test_get_list_shops_requires_auth(self):
    response = client.get("/lists/list-1/shops")
    assert response.status_code == 401
```

Run: `cd backend && python -m pytest tests/api/test_lists.py -v`
Expected: All PASS

**Step 6: Commit**

```bash
cd backend && git add services/lists_service.py api/lists.py models/types.py tests/services/test_lists_service.py tests/api/test_lists.py
git commit -m "feat(lists): add GET /lists/{list_id}/shops for full shop data"
```

---

## Task 5: Backend — Add `PATCH /lists/{list_id}` rename endpoint

**Files:**
- Modify: `backend/services/lists_service.py`
- Modify: `backend/api/lists.py`
- Test: `backend/tests/services/test_lists_service.py`
- Test: `backend/tests/api/test_lists.py`

**API Contract:**
```yaml
endpoint: PATCH /lists/{list_id}
request:
  name: string  # new list name
response:
  id: string
  user_id: string
  name: string  # updated name
  created_at: datetime
  updated_at: datetime
errors:
  401: unauthenticated
  403: list not owned by user
  400: empty name
```

**Step 1: Write the failing service test**

Add to `backend/tests/services/test_lists_service.py`:

```python
async def test_rename_list_succeeds(self, lists_service, mock_supabase):
    """rename() updates the list name via Supabase update."""
    mock_update = MagicMock(
        return_value=MagicMock(
            eq=MagicMock(
                return_value=MagicMock(
                    execute=MagicMock(
                        return_value=MagicMock(
                            data=[
                                {
                                    "id": "l1",
                                    "user_id": "user-1",
                                    "name": "New Name",
                                    "created_at": datetime.now().isoformat(),
                                    "updated_at": datetime.now().isoformat(),
                                }
                            ]
                        )
                    )
                )
            )
        )
    )
    mock_supabase.table = MagicMock(return_value=MagicMock(update=mock_update))
    result = await lists_service.rename(list_id="l1", name="New Name")
    assert result.name == "New Name"

async def test_rename_list_raises_if_not_found_or_unauthorized(
    self, lists_service, mock_supabase
):
    """rename() raises ValueError when RLS blocks the update (0 rows affected)."""
    mock_update = MagicMock(
        return_value=MagicMock(
            eq=MagicMock(
                return_value=MagicMock(
                    execute=MagicMock(return_value=MagicMock(data=[]))
                )
            )
        )
    )
    mock_supabase.table = MagicMock(return_value=MagicMock(update=mock_update))
    with pytest.raises(ValueError, match="not found or access denied"):
        await lists_service.rename(list_id="l1", name="New Name")
```

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest tests/services/test_lists_service.py::TestListsService::test_rename_list_succeeds -v`
Expected: FAIL — `rename` not defined

**Step 3: Write minimal implementation**

Add to `backend/services/lists_service.py`:

```python
async def rename(self, list_id: str, name: str) -> List:
    """Rename a list. RLS ensures only the owner can update.
    Raises ValueError if the list is not found or the caller doesn't own it.
    """
    response = (
        self._db.table("lists")
        .update({"name": name})
        .eq("id", list_id)
        .execute()
    )
    if not response.data:
        raise ValueError("List not found or access denied")
    rows = cast("list[dict[str, Any]]", response.data)
    return List(**first(rows, "rename list"))
```

Add request model and route to `backend/api/lists.py`:

```python
class RenameListRequest(BaseModel):
    name: str

@router.patch("/{list_id}")
async def rename_list(
    list_id: str,
    body: RenameListRequest,
    user: dict[str, Any] = Depends(get_current_user),
    db: Client = Depends(get_user_db),
) -> dict[str, Any]:
    """Rename a list. Auth required."""
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="List name cannot be empty")
    service = ListsService(db=db)
    try:
        result = await service.rename(list_id=list_id, name=body.name.strip())
        return result.model_dump()
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e)) from None
```

**Step 4: Run tests**

Run: `cd backend && python -m pytest tests/services/test_lists_service.py tests/api/test_lists.py -v`
Expected: All PASS

**Step 5: Add API tests**

Add to `backend/tests/api/test_lists.py`:

```python
def test_rename_list_requires_auth(self):
    response = client.patch("/lists/list-1", json={"name": "New"})
    assert response.status_code == 401

def test_rename_list_rejects_empty_name(self):
    mock_db = MagicMock()
    app.dependency_overrides[get_current_user] = lambda: {"id": "user-1"}
    app.dependency_overrides[get_user_db] = lambda: mock_db
    try:
        response = client.patch("/lists/list-1", json={"name": "   "})
        assert response.status_code == 400
    finally:
        app.dependency_overrides.clear()
```

Run: `cd backend && python -m pytest tests/api/test_lists.py -v`
Expected: All PASS

**Step 6: Commit**

```bash
cd backend && git add services/lists_service.py api/lists.py tests/services/test_lists_service.py tests/api/test_lists.py
git commit -m "feat(lists): add PATCH /lists/{list_id} rename endpoint"
```

---

## Task 6: Frontend — Add API proxy routes for new endpoints

**Files:**
- Modify: `app/api/lists/[listId]/route.ts` (add PATCH)
- Modify: `app/api/lists/[listId]/shops/route.ts` (add GET)
- Create: `app/api/lists/pins/route.ts` (new)

No test needed — thin proxy wrappers that delegate to `proxyToBackend()`. Backend tests cover the business logic.

**Step 1: Add PATCH to `app/api/lists/[listId]/route.ts`**

```typescript
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;
  return proxyToBackend(request, `/lists/${listId}`);
}
```

**Step 2: Add GET to `app/api/lists/[listId]/shops/route.ts`**

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;
  return proxyToBackend(request, `/lists/${listId}/shops`);
}
```

**Step 3: Create `app/api/lists/pins/route.ts`**

```typescript
import { NextRequest } from 'next/server';
import { proxyToBackend } from '@/lib/api/proxy';

export async function GET(request: NextRequest) {
  return proxyToBackend(request, '/lists/pins');
}
```

**Step 4: Verify type-check passes**

Run: `pnpm type-check`
Expected: No errors

**Step 5: Commit**

```bash
git add app/api/lists/
git commit -m "feat(lists): add frontend proxy routes for pins, list shops, rename"
```

---

## Task 7: Frontend — Update types and add `makeListWithItems` factory

**Files:**
- Modify: `lib/types/index.ts`
- Modify: `lib/test-utils/factories.ts`

No test needed — type definitions and test helpers.

**Step 1: Update `lib/types/index.ts`**

Add a `ListItem` type and update `List` to include `items`:

```typescript
export interface ListItem {
  shopId: string;
  addedAt: string;
}

export interface List {
  id: string;
  userId: string;
  name: string;
  items: ListItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ListPin {
  listId: string;
  shopId: string;
  lat: number;
  lng: number;
}
```

Remove the old `shopIds: string[]` field from `List`.

**Step 2: Update `lib/test-utils/factories.ts`**

Update `makeList` to include `items`:

```typescript
export function makeList(overrides: Record<string, unknown> = {}) {
  return {
    id: 'list-g7h8i9',
    user_id: 'user-a1b2c3',
    name: '適合工作的咖啡店',
    items: [],
    created_at: TS,
    updated_at: TS,
    ...overrides,
  };
}

export function makeListItem(overrides: Record<string, unknown> = {}) {
  return {
    shop_id: 'shop-d4e5f6',
    added_at: TS,
    ...overrides,
  };
}
```

**Step 3: Verify type-check**

Run: `pnpm type-check`
Expected: No errors (may surface compile errors if `List.shopIds` was used anywhere — fix those)

**Step 4: Commit**

```bash
git add lib/types/index.ts lib/test-utils/factories.ts
git commit -m "feat(lists): update List type to include items, add ListPin and ListItem types"
```

---

## Task 8: Frontend — Build `useUserLists` SWR hook

**Files:**
- Create: `lib/hooks/use-user-lists.ts`
- Create: `lib/hooks/use-user-lists.test.ts`

This is the central state management for the feature. All other components depend on it.

**Step 1: Write the failing tests**

Create `lib/hooks/use-user-lists.test.ts`:

```typescript
import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock supabase auth
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'test-token',
          },
        },
      }),
    },
  }),
}));

import { useUserLists } from './use-user-lists';

const LISTS_RESPONSE = [
  {
    id: 'l1',
    user_id: 'user-1',
    name: 'Work spots',
    items: [
      { shop_id: 's1', added_at: '2026-01-15T10:00:00Z' },
      { shop_id: 's2', added_at: '2026-01-15T11:00:00Z' },
    ],
    created_at: '2026-01-15T10:00:00Z',
    updated_at: '2026-01-15T10:00:00Z',
  },
  {
    id: 'l2',
    user_id: 'user-1',
    name: 'Date night',
    items: [{ shop_id: 's3', added_at: '2026-01-16T10:00:00Z' }],
    created_at: '2026-01-16T10:00:00Z',
    updated_at: '2026-01-16T10:00:00Z',
  },
];

describe('useUserLists', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => LISTS_RESPONSE,
    });
  });

  it('isSaved returns true for a shop in any list', async () => {
    const { result } = renderHook(() => useUserLists());
    await waitFor(() => expect(result.current.lists).toHaveLength(2));
    expect(result.current.isSaved('s1')).toBe(true);
    expect(result.current.isSaved('s3')).toBe(true);
    expect(result.current.isSaved('not-saved')).toBe(false);
  });

  it('isInList returns correct per-list membership', async () => {
    const { result } = renderHook(() => useUserLists());
    await waitFor(() => expect(result.current.lists).toHaveLength(2));
    expect(result.current.isInList('l1', 's1')).toBe(true);
    expect(result.current.isInList('l1', 's3')).toBe(false);
    expect(result.current.isInList('l2', 's3')).toBe(true);
  });

  it('createList calls POST /api/lists and revalidates', async () => {
    const { result } = renderHook(() => useUserLists());
    await waitFor(() => expect(result.current.lists).toHaveLength(2));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'l3', name: 'New' }),
    });

    await act(async () => {
      await result.current.createList('New');
    });

    const postCall = mockFetch.mock.calls.find(
      (c) => c[1]?.method === 'POST' && c[0] === '/api/lists'
    );
    expect(postCall).toBeDefined();
  });

  it('saveShop calls POST /api/lists/{listId}/shops', async () => {
    const { result } = renderHook(() => useUserLists());
    await waitFor(() => expect(result.current.lists).toHaveLength(2));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ list_id: 'l1', shop_id: 's4' }),
    });

    await act(async () => {
      await result.current.saveShop('l1', 's4');
    });

    const postCall = mockFetch.mock.calls.find(
      (c) => c[1]?.method === 'POST' && c[0] === '/api/lists/l1/shops'
    );
    expect(postCall).toBeDefined();
  });

  it('removeShop calls DELETE /api/lists/{listId}/shops/{shopId}', async () => {
    const { result } = renderHook(() => useUserLists());
    await waitFor(() => expect(result.current.lists).toHaveLength(2));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    await act(async () => {
      await result.current.removeShop('l1', 's1');
    });

    const deleteCall = mockFetch.mock.calls.find(
      (c) => c[1]?.method === 'DELETE' && c[0] === '/api/lists/l1/shops/s1'
    );
    expect(deleteCall).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run lib/hooks/use-user-lists.test.ts`
Expected: FAIL — module `./use-user-lists` not found

**Step 3: Write minimal implementation**

Create `lib/hooks/use-user-lists.ts`:

```typescript
'use client';

import { useMemo, useCallback } from 'react';
import useSWR from 'swr';
import { createClient } from '@/lib/supabase/client';

interface ListItemData {
  shop_id: string;
  added_at: string;
}

interface ListData {
  id: string;
  user_id: string;
  name: string;
  items: ListItemData[];
  created_at: string;
  updated_at: string;
}

async function fetchWithAuth(url: string, init?: RequestInit) {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not authenticated');

  const res = await fetch(url, {
    ...init,
    headers: {
      ...init?.headers,
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

const fetcher = (url: string) => fetchWithAuth(url);

export function useUserLists() {
  const { data: lists, error, isLoading, mutate } = useSWR<ListData[]>(
    '/api/lists',
    fetcher
  );

  const savedShopIds = useMemo(() => {
    const set = new Set<string>();
    for (const list of lists ?? []) {
      for (const item of list.items) {
        set.add(item.shop_id);
      }
    }
    return set;
  }, [lists]);

  const listMembership = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const list of lists ?? []) {
      const shopIds = new Set(list.items.map((i) => i.shop_id));
      map.set(list.id, shopIds);
    }
    return map;
  }, [lists]);

  const isSaved = useCallback(
    (shopId: string) => savedShopIds.has(shopId),
    [savedShopIds]
  );

  const isInList = useCallback(
    (listId: string, shopId: string) =>
      listMembership.get(listId)?.has(shopId) ?? false,
    [listMembership]
  );

  const saveShop = useCallback(
    async (listId: string, shopId: string) => {
      // Optimistic update
      const prev = lists;
      mutate(
        lists?.map((l) =>
          l.id === listId
            ? {
                ...l,
                items: [
                  ...l.items,
                  { shop_id: shopId, added_at: new Date().toISOString() },
                ],
              }
            : l
        ),
        false
      );
      try {
        await fetchWithAuth(`/api/lists/${listId}/shops`, {
          method: 'POST',
          body: JSON.stringify({ shop_id: shopId }),
        });
        mutate();
      } catch {
        mutate(prev, false);
        throw new Error('Failed to save shop');
      }
    },
    [lists, mutate]
  );

  const removeShop = useCallback(
    async (listId: string, shopId: string) => {
      const prev = lists;
      mutate(
        lists?.map((l) =>
          l.id === listId
            ? { ...l, items: l.items.filter((i) => i.shop_id !== shopId) }
            : l
        ),
        false
      );
      try {
        await fetchWithAuth(`/api/lists/${listId}/shops/${shopId}`, {
          method: 'DELETE',
        });
        mutate();
      } catch {
        mutate(prev, false);
        throw new Error('Failed to remove shop');
      }
    },
    [lists, mutate]
  );

  const createList = useCallback(
    async (name: string) => {
      await fetchWithAuth('/api/lists', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      mutate();
    },
    [mutate]
  );

  const deleteList = useCallback(
    async (listId: string) => {
      const prev = lists;
      mutate(
        lists?.filter((l) => l.id !== listId),
        false
      );
      try {
        await fetchWithAuth(`/api/lists/${listId}`, {
          method: 'DELETE',
        });
        mutate();
      } catch {
        mutate(prev, false);
        throw new Error('Failed to delete list');
      }
    },
    [lists, mutate]
  );

  const renameList = useCallback(
    async (listId: string, name: string) => {
      const prev = lists;
      mutate(
        lists?.map((l) => (l.id === listId ? { ...l, name } : l)),
        false
      );
      try {
        await fetchWithAuth(`/api/lists/${listId}`, {
          method: 'PATCH',
          body: JSON.stringify({ name }),
        });
        mutate();
      } catch {
        mutate(prev, false);
        throw new Error('Failed to rename list');
      }
    },
    [lists, mutate]
  );

  return {
    lists: lists ?? [],
    isLoading,
    error,
    isSaved,
    isInList,
    saveShop,
    removeShop,
    createList,
    deleteList,
    renameList,
  };
}
```

**Step 4: Run tests**

Run: `pnpm vitest run lib/hooks/use-user-lists.test.ts`
Expected: All PASS

**Step 5: Commit**

```bash
git add lib/hooks/use-user-lists.ts lib/hooks/use-user-lists.test.ts
git commit -m "feat(lists): add useUserLists SWR hook with derived state + optimistic mutations"
```

---

## Task 9: Frontend — Add shadcn Drawer component (vaul)

**Files:**
- Create: `components/ui/drawer.tsx`

No test needed — UI primitive wrapper.

**Step 1: Create the Drawer component**

Create `components/ui/drawer.tsx` following shadcn's vaul wrapper pattern, using the same CVA + cn pattern as `components/ui/button.tsx`. Export `Drawer`, `DrawerTrigger`, `DrawerContent`, `DrawerHeader`, `DrawerTitle`, `DrawerDescription`, `DrawerFooter`, `DrawerClose`.

Reference: [shadcn/ui drawer source](https://ui.shadcn.com/docs/components/drawer) — standard vaul wrapper.

```typescript
'use client';

import * as React from 'react';
import { Drawer as DrawerPrimitive } from 'vaul';
import { cn } from '@/lib/utils';

const Drawer = ({
  shouldScaleBackground = true,
  ...props
}: React.ComponentProps<typeof DrawerPrimitive.Root>) => (
  <DrawerPrimitive.Root shouldScaleBackground={shouldScaleBackground} {...props} />
);
Drawer.displayName = 'Drawer';

const DrawerTrigger = DrawerPrimitive.Trigger;
const DrawerPortal = DrawerPrimitive.Portal;
const DrawerClose = DrawerPrimitive.Close;

const DrawerOverlay = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn('fixed inset-0 z-50 bg-black/80', className)}
    {...props}
  />
));
DrawerOverlay.displayName = DrawerPrimitive.Overlay.displayName;

const DrawerContent = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DrawerPortal>
    <DrawerOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        'fixed inset-x-0 bottom-0 z-50 mt-24 flex h-auto flex-col rounded-t-[10px] border bg-white',
        className
      )}
      {...props}
    >
      <div className="mx-auto mt-4 h-2 w-[100px] rounded-full bg-gray-200" />
      {children}
    </DrawerPrimitive.Content>
  </DrawerPortal>
));
DrawerContent.displayName = 'DrawerContent';

const DrawerHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('grid gap-1.5 p-4 text-center sm:text-left', className)} {...props} />
);
DrawerHeader.displayName = 'DrawerHeader';

const DrawerFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-auto flex flex-col gap-2 p-4', className)} {...props} />
);
DrawerFooter.displayName = 'DrawerFooter';

const DrawerTitle = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DrawerTitle.displayName = DrawerPrimitive.Title.displayName;

const DrawerDescription = React.forwardRef<
  React.ComponentRef<typeof DrawerPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Description
    ref={ref}
    className={cn('text-sm text-gray-500', className)}
    {...props}
  />
));
DrawerDescription.displayName = DrawerPrimitive.Description.displayName;

export {
  Drawer,
  DrawerPortal,
  DrawerOverlay,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerFooter,
  DrawerTitle,
  DrawerDescription,
};
```

**Step 2: Verify type-check**

Run: `pnpm type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add components/ui/drawer.tsx
git commit -m "feat(ui): add shadcn Drawer component (vaul wrapper)"
```

---

## Task 10: Frontend — Build `BookmarkButton` component

**Files:**
- Create: `components/shops/bookmark-button.tsx`
- Create: `components/shops/bookmark-button.test.tsx`

**Step 1: Write the failing tests**

Create `components/shops/bookmark-button.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

// Mock useUserLists
const mockIsSaved = vi.fn();
vi.mock('@/lib/hooks/use-user-lists', () => ({
  useUserLists: () => ({
    lists: [],
    isSaved: mockIsSaved,
    isInList: vi.fn(),
    saveShop: vi.fn(),
    removeShop: vi.fn(),
    createList: vi.fn(),
    deleteList: vi.fn(),
    renameList: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

// Mock supabase auth
const mockGetSession = vi.fn();
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: { getSession: mockGetSession },
  }),
}));

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => '/shops/s1',
}));

import { BookmarkButton } from './bookmark-button';

describe('BookmarkButton', () => {
  it('renders filled icon when shop is saved', () => {
    mockIsSaved.mockReturnValue(true);
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'tok' } },
    });
    render(<BookmarkButton shopId="s1" />);
    const button = screen.getByRole('button', { name: /saved/i });
    expect(button).toBeInTheDocument();
  });

  it('renders empty icon when shop is not saved', () => {
    mockIsSaved.mockReturnValue(false);
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'tok' } },
    });
    render(<BookmarkButton shopId="s1" />);
    const button = screen.getByRole('button', { name: /save/i });
    expect(button).toBeInTheDocument();
  });

  it('redirects to login when unauthenticated user clicks', async () => {
    mockIsSaved.mockReturnValue(false);
    mockGetSession.mockResolvedValue({ data: { session: null } });
    render(<BookmarkButton shopId="s1" />);
    const button = screen.getByRole('button', { name: /save/i });
    await userEvent.click(button);
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringContaining('/login')
    );
  });
});
```

**Step 2: Run to verify it fails**

Run: `pnpm vitest run components/shops/bookmark-button.test.tsx`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `components/shops/bookmark-button.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Bookmark } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useUserLists } from '@/lib/hooks/use-user-lists';
import { SaveToListSheet } from '@/components/lists/save-to-list-sheet';

interface BookmarkButtonProps {
  shopId: string;
  className?: string;
}

export function BookmarkButton({ shopId, className }: BookmarkButtonProps) {
  const { isSaved } = useUserLists();
  const [sheetOpen, setSheetOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const saved = isSaved(shopId);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      router.push(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
    setSheetOpen(true);
  }

  return (
    <>
      <button
        onClick={handleClick}
        className={className}
        aria-label={saved ? 'Saved to list' : 'Save to list'}
      >
        <Bookmark
          className={`h-5 w-5 ${saved ? 'fill-current text-amber-500' : 'text-gray-400'}`}
        />
      </button>
      <SaveToListSheet
        shopId={shopId}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </>
  );
}
```

Note: The `SaveToListSheet` import will fail until Task 11 is done. The test mocks it away. We'll fix the import after Task 11.

**Step 4: Run tests**

Run: `pnpm vitest run components/shops/bookmark-button.test.tsx`
Expected: All PASS (SaveToListSheet is not rendered in tests since sheet is not opened)

**Step 5: Commit**

```bash
git add components/shops/bookmark-button.tsx components/shops/bookmark-button.test.tsx
git commit -m "feat(lists): add BookmarkButton with saved state and auth redirect"
```

---

## Task 11: Frontend — Build `SaveToListSheet` component

**Files:**
- Create: `components/lists/save-to-list-sheet.tsx`
- Create: `components/lists/save-to-list-sheet.test.tsx`

**Step 1: Write the failing tests**

Create `components/lists/save-to-list-sheet.test.tsx`:

```typescript
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

const mockSaveShop = vi.fn();
const mockRemoveShop = vi.fn();
const mockCreateList = vi.fn();

vi.mock('@/lib/hooks/use-user-lists', () => ({
  useUserLists: () => ({
    lists: [
      { id: 'l1', name: 'Work spots', items: [{ shop_id: 's1' }, { shop_id: 's2' }] },
      { id: 'l2', name: 'Date night', items: [{ shop_id: 's3' }] },
    ],
    isSaved: vi.fn(),
    isInList: (listId: string, shopId: string) => {
      if (listId === 'l1' && (shopId === 's1' || shopId === 's2')) return true;
      if (listId === 'l2' && shopId === 's3') return true;
      return false;
    },
    saveShop: mockSaveShop,
    removeShop: mockRemoveShop,
    createList: mockCreateList,
    deleteList: vi.fn(),
    renameList: vi.fn(),
    isLoading: false,
    error: null,
  }),
}));

import { SaveToListSheet } from './save-to-list-sheet';

describe('SaveToListSheet', () => {
  it('shows checked state for lists containing the shop', () => {
    render(<SaveToListSheet shopId="s1" open={true} onOpenChange={vi.fn()} />);
    // s1 is in l1 (Work spots) but not l2 (Date night)
    const workCheckbox = screen.getByRole('checkbox', { name: /work spots/i });
    const dateCheckbox = screen.getByRole('checkbox', { name: /date night/i });
    expect(workCheckbox).toBeChecked();
    expect(dateCheckbox).not.toBeChecked();
  });

  it('calls saveShop when unchecked list is toggled', async () => {
    render(<SaveToListSheet shopId="s1" open={true} onOpenChange={vi.fn()} />);
    const dateCheckbox = screen.getByRole('checkbox', { name: /date night/i });
    await userEvent.click(dateCheckbox);
    expect(mockSaveShop).toHaveBeenCalledWith('l2', 's1');
  });

  it('calls removeShop when checked list is toggled', async () => {
    render(<SaveToListSheet shopId="s1" open={true} onOpenChange={vi.fn()} />);
    const workCheckbox = screen.getByRole('checkbox', { name: /work spots/i });
    await userEvent.click(workCheckbox);
    expect(mockRemoveShop).toHaveBeenCalledWith('l1', 's1');
  });

  it('shows create new list form when fewer than 3 lists', () => {
    render(<SaveToListSheet shopId="s1" open={true} onOpenChange={vi.fn()} />);
    expect(screen.getByText(/create new list/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run to verify it fails**

Run: `pnpm vitest run components/lists/save-to-list-sheet.test.tsx`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `components/lists/save-to-list-sheet.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import { useUserLists } from '@/lib/hooks/use-user-lists';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
  DrawerClose,
} from '@/components/ui/drawer';

interface SaveToListSheetProps {
  shopId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SaveToListSheet({ shopId, open, onOpenChange }: SaveToListSheetProps) {
  const { lists, isInList, saveShop, removeShop, createList } = useUserLists();
  const [newListName, setNewListName] = useState('');
  const [creating, setCreating] = useState(false);

  async function handleToggle(listId: string) {
    try {
      if (isInList(listId, shopId)) {
        await removeShop(listId, shopId);
      } else {
        await saveShop(listId, shopId);
      }
    } catch {
      toast.error('Something went wrong');
    }
  }

  async function handleCreate() {
    if (!newListName.trim()) return;
    setCreating(true);
    try {
      await createList(newListName.trim());
      setNewListName('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create list';
      if (message.includes('3') || message.includes('Maximum')) {
        toast.error("You've reached the 3-list limit");
      } else {
        toast.error(message);
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Save to list</DrawerTitle>
        </DrawerHeader>
        <div className="px-4 pb-2">
          {lists.map((list) => (
            <label
              key={list.id}
              className="flex items-center gap-3 rounded-lg px-2 py-3 hover:bg-gray-50"
            >
              <input
                type="checkbox"
                role="checkbox"
                aria-label={list.name}
                checked={isInList(list.id, shopId)}
                onChange={() => handleToggle(list.id)}
                className="h-5 w-5 rounded border-gray-300"
              />
              <span className="flex-1 text-sm font-medium">{list.name}</span>
              <span className="text-xs text-gray-400">{list.items.length}</span>
            </label>
          ))}
          {lists.length < 3 && (
            <div className="mt-2 flex items-center gap-2">
              <Plus className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Create new list"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="flex-1 border-b border-gray-200 bg-transparent py-1 text-sm outline-none focus:border-gray-400"
                disabled={creating}
              />
              {newListName.trim() && (
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="text-sm font-medium text-blue-600"
                >
                  Add
                </button>
              )}
            </div>
          )}
        </div>
        <DrawerFooter>
          <DrawerClose asChild>
            <button className="w-full rounded-lg bg-gray-900 py-2.5 text-sm font-medium text-white">
              Done
            </button>
          </DrawerClose>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
```

**Step 4: Run tests**

Run: `pnpm vitest run components/lists/save-to-list-sheet.test.tsx`
Expected: All PASS

**Step 5: Commit**

```bash
git add components/lists/save-to-list-sheet.tsx components/lists/save-to-list-sheet.test.tsx
git commit -m "feat(lists): add SaveToListSheet bottom sheet with checkboxes and inline create"
```

---

## Task 12: Frontend — Build `RenameListDialog` component

**Files:**
- Create: `components/lists/rename-list-dialog.tsx`

No separate test needed — tested as part of the lists page integration test (Task 14).

**Step 1: Write implementation**

Create `components/lists/rename-list-dialog.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { useUserLists } from '@/lib/hooks/use-user-lists';

interface RenameListDialogProps {
  listId: string;
  currentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RenameListDialog({
  listId,
  currentName,
  open,
  onOpenChange,
}: RenameListDialogProps) {
  const { renameList } = useUserLists();
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || name.trim() === currentName) {
      onOpenChange(false);
      return;
    }
    setSaving(true);
    try {
      await renameList(listId, name.trim());
      onOpenChange(false);
    } catch {
      toast.error('Failed to rename list');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <form
        onSubmit={handleSubmit}
        className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-semibold">Rename list</h2>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
          autoFocus
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </form>
    </div>
  );
}
```

**Step 2: Verify type-check**

Run: `pnpm type-check`
Expected: No errors

**Step 3: Commit**

```bash
git add components/lists/rename-list-dialog.tsx
git commit -m "feat(lists): add RenameListDialog component"
```

---

## Task 13: Frontend — Build `ListCard` component

**Files:**
- Create: `components/lists/list-card.tsx`
- Create: `components/lists/list-card.test.tsx`

**Step 1: Write the failing tests**

Create `components/lists/list-card.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { ListCard } from './list-card';

describe('ListCard', () => {
  const defaultProps = {
    id: 'l1',
    name: 'Work spots',
    itemCount: 12,
    onRename: vi.fn(),
    onDelete: vi.fn(),
  };

  it('renders list name and shop count', () => {
    render(<ListCard {...defaultProps} />);
    expect(screen.getByText('Work spots')).toBeInTheDocument();
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });

  it('shows menu button for list actions', () => {
    render(<ListCard {...defaultProps} />);
    expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
  });
});
```

**Step 2: Run to verify it fails**

Run: `pnpm vitest run components/lists/list-card.test.tsx`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `components/lists/list-card.tsx`:

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

interface ListCardProps {
  id: string;
  name: string;
  itemCount: number;
  onRename: () => void;
  onDelete: () => void;
}

export function ListCard({ id, name, itemCount, onRename, onDelete }: ListCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  return (
    <div className="group relative rounded-xl border border-gray-200 bg-white p-4 transition hover:shadow-md">
      <Link href={`/lists/${id}`} className="block">
        <h3 className="font-medium text-gray-900">{name}</h3>
        <p className="mt-1 text-sm text-gray-500">
          {itemCount} {itemCount === 1 ? 'shop' : 'shops'}
        </p>
      </Link>

      {/* Desktop: show on hover */}
      <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
        <button
          onClick={(e) => { e.preventDefault(); onRename(); }}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="Rename list"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={(e) => { e.preventDefault(); onDelete(); }}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500"
          aria-label="Delete list"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Mobile: always visible ⋯ menu */}
      <div ref={menuRef} className="absolute right-2 top-2 group-hover:hidden">
        <button
          onClick={(e) => { e.preventDefault(); setMenuOpen(!menuOpen); }}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
          aria-label="List menu"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-8 z-10 min-w-[140px] rounded-lg border bg-white py-1 shadow-lg">
            <button
              onClick={(e) => { e.preventDefault(); setMenuOpen(false); onRename(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Rename
            </button>
            <button
              onClick={(e) => { e.preventDefault(); setMenuOpen(false); onDelete(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-gray-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Step 4: Run tests**

Run: `pnpm vitest run components/lists/list-card.test.tsx`
Expected: All PASS

**Step 5: Commit**

```bash
git add components/lists/list-card.tsx components/lists/list-card.test.tsx
git commit -m "feat(lists): add ListCard component with desktop hover actions and mobile menu"
```

---

## Task 14: Frontend — Build `/lists` page

**Files:**
- Modify: `app/(protected)/lists/page.tsx` (overwrite scaffold)
- Modify: `app/(protected)/lists/page.test.tsx` (overwrite basic test)

**Step 1: Write the failing tests**

Overwrite `app/(protected)/lists/page.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockLists = [
  { id: 'l1', name: 'Work spots', items: [{ shop_id: 's1' }, { shop_id: 's2' }], created_at: '2026-01-15', updated_at: '2026-01-15' },
  { id: 'l2', name: 'Date night', items: [{ shop_id: 's3' }], created_at: '2026-01-16', updated_at: '2026-01-16' },
  { id: 'l3', name: 'Weekend', items: [], created_at: '2026-01-17', updated_at: '2026-01-17' },
];

vi.mock('@/lib/hooks/use-user-lists', () => ({
  useUserLists: () => ({
    lists: mockLists,
    isLoading: false,
    error: null,
    isSaved: vi.fn(),
    isInList: vi.fn(),
    saveShop: vi.fn(),
    removeShop: vi.fn(),
    createList: vi.fn(),
    deleteList: vi.fn(),
    renameList: vi.fn(),
  }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

// Mock the map component to avoid Mapbox GL in tests
vi.mock('react-map-gl', () => ({
  default: () => <div data-testid="mock-map" />,
  Marker: () => null,
}));

import ListsPage from './page';

describe('/lists page', () => {
  it('renders list cards', () => {
    render(<ListsPage />);
    expect(screen.getByText('Work spots')).toBeInTheDocument();
    expect(screen.getByText('Date night')).toBeInTheDocument();
    expect(screen.getByText('Weekend')).toBeInTheDocument();
  });

  it('shows 3/3 cap indicator when at limit', () => {
    render(<ListsPage />);
    expect(screen.getByText(/3.*\/.*3/)).toBeInTheDocument();
  });

  it('hides create button when at 3 lists', () => {
    render(<ListsPage />);
    expect(screen.queryByText(/create new list/i)).not.toBeInTheDocument();
  });
});
```

**Step 2: Run to verify it fails**

Run: `pnpm vitest run app/\\(protected\\)/lists/page.test.tsx`
Expected: FAIL — current scaffold renders "Coming soon"

**Step 3: Write implementation**

Overwrite `app/(protected)/lists/page.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useUserLists } from '@/lib/hooks/use-user-lists';
import { ListCard } from '@/components/lists/list-card';
import { RenameListDialog } from '@/components/lists/rename-list-dialog';

export default function ListsPage() {
  const { lists, isLoading, createList, deleteList } = useUserLists();
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [newListName, setNewListName] = useState('');

  async function handleDelete(listId: string, listName: string) {
    if (!confirm(`Delete "${listName}"? This won't remove the shops.`)) return;
    try {
      await deleteList(listId);
      toast.success('List deleted');
    } catch {
      toast.error('Failed to delete list');
    }
  }

  async function handleCreate() {
    if (!newListName.trim()) return;
    try {
      await createList(newListName.trim());
      setNewListName('');
      toast.success('List created');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create list';
      if (message.includes('3') || message.includes('Maximum')) {
        toast.error("You've reached the 3-list limit");
      } else {
        toast.error(message);
      }
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading lists...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold">My Lists</h1>
        <span className="text-sm text-gray-500">
          {lists.length} / 3
        </span>
      </div>

      {/* TODO: Mini map — will use react-map-gl with GET /api/lists/pins.
          Deferred to a follow-up task after core list CRUD is working. */}

      {lists.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-gray-500">No lists yet</p>
          <p className="mt-1 text-sm text-gray-400">
            Save shops from the directory to start building your collections.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lists.map((list) => (
            <ListCard
              key={list.id}
              id={list.id}
              name={list.name}
              itemCount={list.items.length}
              onRename={() => setRenaming({ id: list.id, name: list.name })}
              onDelete={() => handleDelete(list.id, list.name)}
            />
          ))}
        </div>
      )}

      {lists.length < 3 && (
        <div className="mt-4 flex items-center gap-2">
          <Plus className="h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Create new list"
            value={newListName}
            onChange={(e) => setNewListName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            className="flex-1 border-b border-gray-200 bg-transparent py-2 text-sm outline-none focus:border-gray-400"
          />
          {newListName.trim() && (
            <button
              onClick={handleCreate}
              className="text-sm font-medium text-blue-600"
            >
              Add
            </button>
          )}
        </div>
      )}

      {renaming && (
        <RenameListDialog
          listId={renaming.id}
          currentName={renaming.name}
          open={!!renaming}
          onOpenChange={(open) => !open && setRenaming(null)}
        />
      )}
    </div>
  );
}
```

**Step 4: Run tests**

Run: `pnpm vitest run app/\\(protected\\)/lists/page.test.tsx`
Expected: All PASS

**Step 5: Commit**

```bash
git add app/\(protected\)/lists/page.tsx app/\(protected\)/lists/page.test.tsx
git commit -m "feat(lists): build /lists page with list cards, create, rename, delete"
```

---

## Task 15: Frontend — Build `/lists/[listId]` page (split map + shop list)

**Files:**
- Create: `app/(protected)/lists/[listId]/page.tsx`
- Create: `app/(protected)/lists/[listId]/page.test.tsx`

**Step 1: Write the failing tests**

Create `app/(protected)/lists/[listId]/page.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useParams: () => ({ listId: 'l1' }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

vi.mock('@/lib/hooks/use-user-lists', () => ({
  useUserLists: () => ({
    lists: [
      { id: 'l1', name: 'Work spots', items: [{ shop_id: 's1' }, { shop_id: 's2' }] },
    ],
    isLoading: false,
    removeShop: vi.fn(),
    deleteList: vi.fn(),
    renameList: vi.fn(),
    isSaved: vi.fn(),
    isInList: vi.fn(),
    saveShop: vi.fn(),
    createList: vi.fn(),
    error: null,
  }),
}));

// Mock fetch for GET /api/lists/l1/shops
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => [
    {
      id: 's1',
      name: '山小孩咖啡',
      address: '台北市大安區溫州街74巷',
      latitude: 25.0216,
      longitude: 121.5312,
      rating: 4.6,
      review_count: 287,
      photo_urls: [],
      taxonomy_tags: [],
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
    {
      id: 's2',
      name: 'Simple Kaffa',
      address: '台北市中山區赤峰街1號',
      latitude: 25.0528,
      longitude: 121.5201,
      rating: 4.5,
      review_count: 512,
      photo_urls: [],
      taxonomy_tags: [],
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    },
  ],
});

vi.mock('react-map-gl', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-map">{children}</div>
  ),
  Marker: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-marker">{children}</div>
  ),
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: 'tok' } },
      }),
    },
  }),
}));

import ListDetailPage from './page';

describe('/lists/[listId] page', () => {
  it('renders the list name in the header', async () => {
    render(<ListDetailPage />);
    expect(await screen.findByText('Work spots')).toBeInTheDocument();
  });

  it('renders shop cards from the list', async () => {
    render(<ListDetailPage />);
    expect(await screen.findByText('山小孩咖啡')).toBeInTheDocument();
    expect(await screen.findByText('Simple Kaffa')).toBeInTheDocument();
  });

  it('shows empty state when list has no shops', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => [],
    });
    render(<ListDetailPage />);
    expect(await screen.findByText(/no shops saved yet/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run to verify it fails**

Run: `pnpm vitest run app/\\(protected\\)/lists/\\[listId\\]/page.test.tsx`
Expected: FAIL — module not found

**Step 3: Write implementation**

Create `app/(protected)/lists/[listId]/page.tsx`:

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Pencil, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { useUserLists } from '@/lib/hooks/use-user-lists';
import { RenameListDialog } from '@/components/lists/rename-list-dialog';

interface ShopData {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating: number | null;
  review_count: number;
  photo_urls: string[];
  taxonomy_tags: { label_zh: string }[];
}

export default function ListDetailPage() {
  const { listId } = useParams<{ listId: string }>();
  const router = useRouter();
  const { lists, removeShop, deleteList } = useUserLists();
  const list = lists.find((l) => l.id === listId);

  const [shops, setShops] = useState<ShopData[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredShopId, setHoveredShopId] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const shopRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const fetchShops = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;

      const res = await fetch(`/api/lists/${listId}/shops`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const shopData = await res.json();
        setShops(shopData);
      }
    } finally {
      setLoading(false);
    }
  }, [listId]);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  async function handleRemoveShop(shopId: string) {
    try {
      await removeShop(listId, shopId);
      setShops((prev) => prev.filter((s) => s.id !== shopId));
      toast.success('Shop removed');
    } catch {
      toast.error('Failed to remove shop');
    }
  }

  async function handleDeleteList() {
    if (!list) return;
    if (!confirm(`Delete "${list.name}"? This won't remove the shops.`)) return;
    try {
      await deleteList(listId);
      toast.success('List deleted');
      router.push('/lists');
    } catch {
      toast.error('Failed to delete list');
    }
  }

  function scrollToShop(shopId: string) {
    shopRefs.current.get(shopId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  if (!list && !loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">List not found</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <button onClick={() => router.back()} aria-label="Go back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="flex-1 text-lg font-bold">{list?.name}</h1>
        <button
          onClick={() => setRenaming(true)}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100"
          aria-label="Rename list"
        >
          <Pencil className="h-4 w-4" />
        </button>
        <button
          onClick={handleDeleteList}
          className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500"
          aria-label="Delete list"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {/* Map area — placeholder until Mapbox integration */}
      <div className="h-[40vh] w-full bg-gray-100" data-testid="map-area">
        {/* TODO: integrate react-map-gl with shop pins and hover highlighting */}
        <div className="flex h-full items-center justify-center text-sm text-gray-400">
          Map view — {shops.length} pins
        </div>
      </div>

      {/* Shop list */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? (
          <p className="text-center text-gray-500">Loading shops...</p>
        ) : shops.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-500">No shops saved yet</p>
            <p className="mt-1 text-sm text-gray-400">Go explore and save some shops!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {shops.map((shop) => (
              <div
                key={shop.id}
                ref={(el) => {
                  if (el) shopRefs.current.set(shop.id, el);
                }}
                onMouseEnter={() => setHoveredShopId(shop.id)}
                onMouseLeave={() => setHoveredShopId(null)}
                onClick={() => {
                  setHoveredShopId(shop.id);
                  scrollToShop(shop.id);
                }}
                className={`flex items-center justify-between rounded-xl border p-4 transition ${
                  hoveredShopId === shop.id
                    ? 'border-amber-300 bg-amber-50'
                    : 'border-gray-200 bg-white hover:shadow-sm'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <h3 className="font-medium text-gray-900">{shop.name}</h3>
                  <p className="mt-0.5 text-sm text-gray-500">
                    {shop.rating && `★ ${shop.rating}`}
                    {shop.address && ` · ${shop.address.split('區')[0]}區`}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveShop(shop.id);
                  }}
                  className="ml-3 rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-red-500"
                  aria-label={`Remove ${shop.name}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {renaming && list && (
        <RenameListDialog
          listId={list.id}
          currentName={list.name}
          open={renaming}
          onOpenChange={setRenaming}
        />
      )}
    </div>
  );
}
```

**Step 4: Run tests**

Run: `pnpm vitest run app/\\(protected\\)/lists/\\[listId\\]/page.test.tsx`
Expected: All PASS

**Step 5: Commit**

```bash
git add app/\(protected\)/lists/\[listId\]/
git commit -m "feat(lists): build /lists/[listId] page with split map + shop list + hover highlight"
```

---

## Task 16: Final — Run full test suite + type-check + lint

**Files:** None (validation only)

**Step 1: Run backend tests**

Run: `cd backend && python -m pytest -v`
Expected: All PASS

**Step 2: Run frontend tests**

Run: `pnpm test`
Expected: All PASS

**Step 3: Run type-check**

Run: `pnpm type-check`
Expected: No errors

**Step 4: Run lint**

Run: `pnpm lint`
Expected: No errors (fix any that appear)

**Step 5: Final commit (if lint fixes needed)**

```bash
git add -A
git commit -m "fix: lint and type-check cleanup for lists feature"
```

---

## Execution Waves

```mermaid
graph TD
    T1[Task 1: Install deps] --> T7[Task 7: Types + factories]
    T1 --> T9[Task 9: Drawer component]
    T2[Task 2: Enhance get_by_user] --> T3[Task 3: GET /lists/pins]
    T2 --> T4[Task 4: GET /lists/{id}/shops]
    T2 --> T5[Task 5: PATCH rename]
    T3 --> T6[Task 6: Frontend proxies]
    T4 --> T6
    T5 --> T6
    T7 --> T8[Task 8: useUserLists hook]
    T9 --> T11[Task 11: SaveToListSheet]
    T8 --> T10[Task 10: BookmarkButton]
    T8 --> T11
    T8 --> T12[Task 12: RenameListDialog]
    T8 --> T13[Task 13: ListCard]
    T10 --> T14[Task 14: /lists page]
    T11 --> T14
    T12 --> T14
    T13 --> T14
    T6 --> T15[Task 15: /lists/listId page]
    T14 --> T15
    T15 --> T16[Task 16: Full validation]

    subgraph "Wave 1 — Foundation"
        T1
        T2
    end
    subgraph "Wave 2 — Backend endpoints + Frontend primitives"
        T3
        T4
        T5
        T7
        T9
    end
    subgraph "Wave 3 — Frontend core"
        T6
        T8
    end
    subgraph "Wave 4 — UI components"
        T10
        T11
        T12
        T13
    end
    subgraph "Wave 5 — Pages"
        T14
        T15
    end
    subgraph "Wave 6 — Validation"
        T16
    end
```

**Wave 1** (parallel — no dependencies):
- Task 1: Install frontend deps (swr, vaul, react-map-gl, mapbox-gl)
- Task 2: Backend — enhance `get_by_user` with items

**Wave 2** (parallel — depends on Wave 1):
- Task 3: Backend — `GET /lists/pins` ← Task 2
- Task 4: Backend — `GET /lists/{list_id}/shops` ← Task 2
- Task 5: Backend — `PATCH /lists/{list_id}` rename ← Task 2
- Task 7: Frontend types + factories ← Task 1
- Task 9: Drawer UI component ← Task 1

**Wave 3** (parallel — depends on Wave 2):
- Task 6: Frontend API proxies ← Tasks 3, 4, 5
- Task 8: `useUserLists` hook ← Task 7

**Wave 4** (parallel — depends on Wave 3):
- Task 10: BookmarkButton ← Task 8
- Task 11: SaveToListSheet ← Tasks 8, 9
- Task 12: RenameListDialog ← Task 8
- Task 13: ListCard ← Task 8

**Wave 5** (sequential — depends on Wave 4):
- Task 14: `/lists` page ← Tasks 10, 11, 12, 13
- Task 15: `/lists/[listId]` page ← Tasks 6, 14

**Wave 6** (sequential — depends on Wave 5):
- Task 16: Full test suite + type-check + lint validation

---

## Deferred Work (not in this plan)

- **Mini map on `/lists` page**: The `/lists` page has a TODO comment for the Mapbox mini map using `GET /api/lists/pins`. This requires `react-map-gl` integration which is installed but not wired. Implement after core CRUD is stable.
- **Map on `/lists/[listId]` page**: The list detail page has a placeholder map area. Full Mapbox integration with hover-highlighted pins is deferred to a follow-up. The hover state wiring (`hoveredShopId`) is already built.
- **BookmarkButton on shop cards / shop detail**: The component exists but needs to be added to the shop card and shop detail page layouts — those pages don't exist yet in the public-facing app (only admin pages exist).
