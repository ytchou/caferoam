# supabase-py Usage Patterns

Correct API patterns for the `supabase` Python SDK as used in this codebase.

> This codebase uses the **synchronous** `supabase.Client` (not `AsyncClient`).
> All database calls are `db.table(...).operation(...).execute()` with no `await`.

---

## Imports

```python
from supabase import Client
from core.db import first
```

The `Client` type is used in FastAPI dependency injection signatures:

```python
from api.deps import get_user_db, get_admin_db

async def my_endpoint(
    db: Client = Depends(get_user_db),
    admin_db: Client = Depends(get_admin_db),
) -> dict[str, Any]:
    ...
```

Three client constructors exist in `backend/db/supabase_client.py`:

- `get_user_client(token)` -- per-request, RLS-aware (user's JWT sets `auth.uid()`)
- `get_anon_client()` -- cached singleton, RLS-aware, no user context
- `get_service_role_client()` -- cached singleton, bypasses RLS (admin/workers only)

---

## Querying Rows

### Select multiple rows

```python
response = (
    db.table("shops")
    .select("id, name, latitude, longitude")
    .gte("latitude", bounds.min_lat)
    .lte("latitude", bounds.max_lat)
    .execute()
)
shops: list[dict[str, Any]] = response.data or []
```

### Select with negation filter

Use `.not_.is_()` to exclude nulls:

```python
response = (
    db.table("shops")
    .select("cafenomad_id")
    .not_.is_("cafenomad_id", "null")
    .execute()
)
ids: set[str] = {row["cafenomad_id"] for row in (response.data or [])}
```

### Select with ordering and limit

```python
response = (
    db.table("lists")
    .select("*")
    .eq("user_id", user_id)
    .order("created_at", desc=True)
    .execute()
)
```

```python
response = (
    db.table("profiles")
    .select("id")
    .eq("id", user_id)
    .limit(1)
    .execute()
)
```

### Get exactly one row -- use `first()`

When you expect at least one row and want the first element:

```python
from core.db import first

response = db.table("shops").insert({...}).execute()
row = first(response.data, "import shop")
```

`first()` raises `RuntimeError` with a descriptive message if the list is empty, instead of the opaque `IndexError` from `[0]`.

### Get exactly one row -- use `.single()` for lookup-by-PK

When fetching a single row by primary key where exactly one result is expected:

```python
response = db.table("shops").select("*").eq("id", shop_id).single().execute()
shop = cast("dict[str, Any]", response.data)
```

`.single()` returns `response.data` as a **dict** (not a list). It raises an API error if zero or multiple rows match.

Use `.single()` for read-by-PK lookups. Use `first()` for write operations (insert/update) that return a list.

---

## NEVER Do This

### Never use `.data[0]`

```python
# BAD -- opaque IndexError if empty
row = response.data[0]

# GOOD -- descriptive error with context
row = first(response.data, "fetch shop by cafenomad_id")
```

This is a project-wide rule. The `first()` helper from `backend/core/db.py` must be used for all `[0]` array access on query results.

### Never use `.single()` after write operations

`.single()` is for reads. After `.insert()` or `.update()`, the response is always a list. Use `first()`:

```python
# BAD
response = db.table("shops").insert({...}).single().execute()

# GOOD
response = db.table("shops").insert({...}).execute()
row = first(response.data, "insert shop")
```

---

## Inserting Rows

### Single insert

```python
response = (
    db.table("shops")
    .insert(
        {
            "name": name,
            "address": address,
            "latitude": lat,
            "longitude": lng,
            "source": "cafe_nomad",
            "processing_status": "pending_url_check",
        }
    )
    .execute()
)
row = first(response.data, "insert shop")
```

### Bulk upsert

```python
db.table("shop_photos").upsert(
    photo_rows, on_conflict="shop_id,url"
).execute()
```

---

## Updating Rows

### Update and return the result

```python
response = (
    db.table("profiles")
    .update({"pdpa_consent_at": datetime.now(UTC).isoformat()})
    .eq("id", user["id"])
    .is_("pdpa_consent_at", "null")
    .execute()
)
if not response.data:
    # no rows matched the filter -- handle accordingly
    ...
row = first(cast("list[dict[str, Any]]", response.data), "update profile")
```

### Update without checking the return value

```python
db.table("shops").update(
    {"processing_status": "enriching", "updated_at": datetime.now(UTC).isoformat()}
).eq("id", shop_id).execute()
```

---

## Deleting Rows

```python
response = db.table("lists").delete().eq("id", list_id).execute()
if not response.data:
    raise HTTPException(status_code=404, detail="List not found")
```

```python
# Delete all rows matching a filter (no return check needed)
db.table("shop_tags").delete().eq("shop_id", shop_id).execute()
```

---

## Checking Existence

Use `bool(response.data)` to check if any rows were returned:

```python
response = (
    db.table("profiles")
    .update({"deletion_requested_at": datetime.now(UTC).isoformat()})
    .eq("id", user["id"])
    .is_("deletion_requested_at", "null")
    .execute()
)
if not response.data:
    # Update matched zero rows -- the column was already set
    ...
```

For empty list fallback, use `response.data or []`:

```python
existing_shops: list[dict[str, Any]] = response.data or []
```

---

## Chain Order

The correct method chain order is:

```
db.table("TABLE") -> operation -> filters -> modifiers -> .execute()
```

Where:

- **operation**: `.select()`, `.insert()`, `.update()`, `.delete()`, `.upsert()`
- **filters**: `.eq()`, `.gte()`, `.lte()`, `.is_()`, `.not_.is_()`, `.in_()`
- **modifiers**: `.order()`, `.limit()`, `.single()`
- **terminal**: `.execute()` (always last)

Examples:

```python
# select with filters and ordering
db.table("lists").select("*").eq("user_id", uid).order("created_at", desc=True).execute()

# update with multiple filters
db.table("profiles").update({...}).eq("id", uid).is_("pdpa_consent_at", "null").execute()

# select single row by PK
db.table("shops").select("*").eq("id", shop_id).single().execute()
```

---

## Error Handling

### Wrap individual inserts in try/except for batch operations

```python
for shop in shops:
    try:
        response = db.table("shops").insert({...}).execute()
        first(response.data, "import shop")
        imported += 1
    except Exception:
        logger.warning("Failed to import shop", name=shop["name"])
        continue
```

### Use HTTPException for API-layer errors

```python
try:
    response = db.table("shops").select("*").eq("id", shop_id).single().execute()
except Exception:
    raise HTTPException(status_code=404, detail=f"Shop {shop_id} not found") from None
```

---

## `first()` Helper Reference

Defined in `backend/core/db.py`:

```python
def first[T](rows: list[T], context: str = "query") -> T:
    """Return the first element of a non-empty list.

    Raises RuntimeError with a descriptive message if the list is empty,
    rather than the opaque IndexError you'd get from rows[0].
    """
    if not rows:
        raise RuntimeError(f"Expected at least one row from {context}, got 0")
    return rows[0]
```

Always pass a meaningful `context` string so error messages are actionable:

```python
first(response.data, "import cafe nomad shop")
first(response.data, "record consent")
first(response.data, "cancel deletion")
```
