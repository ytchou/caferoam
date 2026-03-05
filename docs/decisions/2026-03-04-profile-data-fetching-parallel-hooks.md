# ADR: Profile page uses parallel SWR hooks, not a single aggregation endpoint

Date: 2026-03-04

## Decision

The `/profile` page fetches data via four parallel SWR hooks (`useUserProfile`, `useUserStamps`, `useUserCheckins`, `useUserLists`), each hitting its own endpoint, rather than a single `GET /profile/full` aggregation endpoint.

## Context

The profile page needs data from four distinct sources: profile metadata + stats, stamps, check-in history, and user lists. Two architectural patterns were considered.

## Alternatives Considered

- **`GET /users/me` aggregation endpoint**: One backend endpoint returns all profile data. Rejected: over-fetches data for tabs that may never be viewed; harder to cache individual sections; requires a new backend data shape that duplicates logic from existing endpoints.
- **Next.js Server Components with parallel server-side fetches**: Fast initial render, no client-side loading states. Rejected: all existing protected routes use client-side SWR + `fetchWithAuth`; adopting server components here would be an architectural departure requiring the auth token to flow server-side, which conflicts with the current Supabase SSR setup.

## Rationale

Parallel SWR hooks are consistent with the existing codebase pattern across all protected routes (lists, stamps, check-ins all use this pattern). Each section can be cached and invalidated independently (e.g., checking in at a new shop invalidates stamps and checkins but not profile metadata). The 4-request overhead is acceptable — requests are parallel, and the profile page is not a first-paint critical path.

## Consequences

- Advantage: Consistent with existing patterns — no new architectural surface area.
- Advantage: Each section can be independently refreshed after mutations (e.g., new check-in updates check-in tab without refetching stamps).
- Disadvantage: 4 network requests on page load vs. 1. Acceptable for a profile page but would need revisiting if profile becomes a landing page.
