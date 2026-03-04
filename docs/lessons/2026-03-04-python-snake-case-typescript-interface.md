# Python model_dump() sends snake_case — TypeScript interfaces must match

**Date:** 2026-03-04
**Context:** Reviews feature — `ShopReview` TypeScript interface used camelCase (`displayName`, `reviewText`, `confirmedTags`, `reviewedAt`), but Pydantic's `model_dump()` outputs snake_case. All fields rendered as `undefined`.

**What happened:**
The Python `ShopReview` Pydantic model uses snake_case field names. `fetchWithAuth()` does no case conversion. The TypeScript `ShopReview` interface was written with camelCase, matching neither the wire format nor the React convention for "what came from the API".

**Root cause:**
Developer assumed TypeScript interfaces should use camelCase (JavaScript convention) without checking whether `fetchWithAuth` performed any key transformation.

**Prevention:**
- Check `lib/api/fetch.ts` — it does NOT camelCase-convert responses.
- TypeScript interfaces for API responses must mirror the Python Pydantic model field names (snake_case).
- The camelCase convention applies only to locally-computed state and component props, not to API response shapes.
- When writing a new Pydantic model + TypeScript interface pair, write the TS interface immediately after the Python model and verify field names match.
