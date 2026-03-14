# ADR: Pydantic alias_generator for camelCase JSON serialization

Date: 2026-03-14

## Decision

Use Pydantic's `alias_generator = to_camel` on a shared `CamelModel` base class so that Python code stays snake_case internally while JSON API responses serialize as camelCase.

## Context

CafeRoam has a Python backend (FastAPI/Pydantic) and a TypeScript frontend (Next.js). Python convention is snake_case; JavaScript convention is camelCase. The API boundary sits between them. Without a conversion strategy, frontend components accumulate defensive dual-casing patterns (`tag.label_zh ?? tag.labelZh`) and union types.

## Alternatives Considered

- **Frontend transform layer**: Add a `snakeToCamel` utility in `lib/api/fetch.ts` that converts all API responses. Rejected: adds runtime overhead on every fetch, requires maintaining a transform function, and creates a second place where the type contract is defined.

- **Accept snake_case in frontend types**: Change all TypeScript interfaces to snake_case to match Python directly. Rejected: breaks JavaScript/React conventions, fights against the ecosystem (all JS libraries use camelCase), and would require renaming every prop and variable in the frontend.

## Rationale

Pydantic's `alias_generator` is a zero-cost configuration flag — it hooks into the existing serialization pipeline with no runtime overhead. Python code remains idiomatic (`review_count`), JSON output is idiomatic (`reviewCount`), and TypeScript types match without any transform layer. This is the standard pattern for FastAPI + TypeScript frontends.

## Consequences

- Advantage: Single source of truth — Pydantic models define both internal Python types and external JSON contracts
- Advantage: No runtime transform needed in frontend fetch utilities
- Advantage: Eliminates all dual-casing workarounds in frontend components
- Disadvantage: Backend tests that assert on JSON response keys must be updated to camelCase
- Disadvantage: `populate_by_name = True` is required so Python code can still use snake_case field names internally
