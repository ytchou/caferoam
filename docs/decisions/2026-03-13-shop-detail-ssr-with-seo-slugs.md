# ADR: SSR Shop Detail with SEO Slugs

Date: 2026-03-13

## Decision
Shop detail pages use Next.js server components (SSR) with SEO-friendly slug URLs (`/shops/[shopId]/[slug]`), while Map and Search pages use client-side rendering (CSR).

## Context
CafeRoam's Threads distribution strategy depends on shareable shop links generating rich social previews (og:image, og:title). The rendering strategy directly affects SEO, social shareability, and LCP performance.

## Alternatives Considered
- **Full SSR:** Maximum SEO, fastest initial paint. Rejected: Map and Search require heavy client interactivity (Mapbox, SWR-driven search) — impractical without complex client islands.
- **Full CSR (SWR everywhere):** Simplest, consistent with existing pages. Rejected: Shop detail would have no social preview meta tags and poor LCP — fatal for Threads distribution.
- **Public route without slugs (`/shops/[shopId]`):** Simpler. Rejected: Human-readable URLs improve SEO and user trust when sharing links on Threads.

## Rationale
Hybrid (SSR for Shop Detail, CSR for Map/Search) matches access patterns: Shop Detail is the landing page from shared links (needs LCP + meta tags); Map/Search are interactive exploration tools (benefit from client-side SWR state). SEO slugs improve link readability in Threads posts.

## Consequences
- Advantage: Rich social previews on Threads/LINE, better SEO, fast LCP for shared links
- Advantage: Map/Search remain simple CSR with SWR hooks (consistent with existing patterns)
- Disadvantage: Requires slug generation in enrichment pipeline + `slug` DB column migration
- Disadvantage: Slug mismatch handling adds 301 redirect logic
