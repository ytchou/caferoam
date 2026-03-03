# Coordinate truthiness check silently drops shops at 0.0 lat/lng

**Date:** 2026-03-03
**Context:** `get_pins` in `lists_service.py` — filtered shops before returning map pins

## What happened

Coordinate guard written as:

```python
if shop_data and shop_data.get("latitude") and shop_data.get("longitude"):
```

Shops with latitude or longitude of exactly `0.0` are falsy in Python, so they are silently
excluded from the pin list. No error is raised; the shop simply doesn't appear on the map.
Taiwan isn't at the equator, but the pattern propagates to other features (search, check-ins).

## Root cause

Python truthiness treats `0`, `0.0`, and `None` the same way. The intent was to filter
`None` values (no coordinates stored), not to filter the number `0.0`.

## Prevention

Always use `is not None` when filtering optional numeric fields — never bare truthiness:

```python
# Wrong — silently drops 0.0
if shop_data.get("latitude") and shop_data.get("longitude"):

# Correct — only filters absent values
if shop_data.get("latitude") is not None and shop_data.get("longitude") is not None:
```

This applies to any numeric field that has a meaningful zero value: coordinates, prices,
ratings at 0.0, review counts, etc.
