# ADR: URL-Driven Search State Across Tabs

Date: 2026-03-13

## Decision
Search state (query text, active mode, filters) is stored in URL search params (`?q=...&mode=...&filters=...`) and persists when navigating between Home, Map, and Search tabs.

## Context
The approved UX design shows Home and Map as separate tabs with independent search bars. When a user searches on Home, they transition to Map in search-results mode. The question was how to manage cross-tab search state.

## Alternatives Considered
- **Separate tab state (no persistence):** Each tab has independent state. Rejected: Users lose their query when switching tabs, forcing re-entry — frustrating for the primary discovery flow.
- **Unified SPA feel (inline results, no route change):** Results appear inline without route transitions. Rejected: Harder to share search contexts via URL; breaks the mental model of distinct tabs.

## Rationale
URL params are the natural state container — bookmarkable, shareable, and survive page refreshes. A shared `useSearchState` hook reads/writes `searchParams`, so Home→Map preserves the active query without React context or global store.

## Consequences
- Advantage: Search context is shareable via URL (e.g., a pre-filtered map link)
- Advantage: Browser back/forward navigation works naturally with search state
- Advantage: No global state management — URL is single source of truth
- Disadvantage: URL can get long with many active filters (mitigated by short param names)
