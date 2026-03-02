# Admin Dashboard: API Contract + Security Patterns
**Date:** 2026-03-02
**Context:** Pass 2 code review of feat/admin-dashboard — 33 issues found, all resolved

## 1. Proxy Route Completeness
**What happened:** `approve` proxy route was created but `reject` was forgotten. Frontend Reject button silently hit Next.js 404.
**Prevention:** Whenever adding paired actions (approve/reject, publish/unpublish), create BOTH proxy routes in the same commit. Use a checklist: backend endpoint → proxy route → frontend button.

## 2. Shared Error State Destroys UI
**What happened:** Single `error` state shared between data load and action handlers. A failed "Cancel job" replaced the entire job table with an error, requiring a full page reload.
**Prevention:** Always use separate state for action-level errors vs. data-load errors. Data load errors block rendering; action errors display inline without destroying the page.

## 3. JobType Enum as Pydantic Field
**What happened:** `EnqueueRequest.job_type: str` with manual `try/except ValueError` — Pydantic can do this automatically.
**Prevention:** When a field maps to an enum, use the enum type directly in Pydantic models. Pydantic returns a structured 422 with field errors, and OpenAPI docs show valid values automatically.

## 4. SECURITY DEFINER Functions Need REVOKE
**What happened:** `shops_with_low_confidence_tags()` and `admin_search_shops()` used `SECURITY DEFINER` but lacked `REVOKE EXECUTE FROM PUBLIC`. Any authenticated user could call them directly via PostgREST.
**Prevention:** Every `SECURITY DEFINER` function that is admin-only must have `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC` immediately after the CREATE. Make this a non-negotiable migration template.

## 5. In-Function Imports Cause Linter Failures
**What happened:** `import datetime` inside `approve_submission()` — works at runtime but triggers ruff PLC0415 and disrupts isort ordering.
**Prevention:** All imports go at module level. If a function needs a stdlib module that isn't already imported, add it to the module-level imports, not inside the function.

## 6. FastAPI Depends() for Provider Injection
**What happened:** `get_embeddings_provider()` called directly inside the route handler, then patched via `unittest.mock.patch()` in tests — mocking an internal factory instead of a system boundary.
**Prevention:** Provider factories that tests need to stub should be FastAPI `Depends()` parameters. Then tests use `app.dependency_overrides[factory] = lambda: stub` — no path coupling, no internal module patching.

## 7. RPC Normalization at API Layer
**What happened:** `shops_with_low_confidence_tags()` returned `shop_id`/`shop_name` while `missing_embeddings` returned `id`/`name`. Frontend had to handle two key conventions for the same concept.
**Prevention:** Normalize inconsistent RPC output in the Python API layer before returning to clients. A list comprehension to remap keys is trivial and prevents TypeScript interface duplication.
