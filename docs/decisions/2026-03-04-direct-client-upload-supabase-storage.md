# ADR: Direct Client Upload to Supabase Storage for Check-in Photos

Date: 2026-03-04

## Decision

Use direct client-side upload to Supabase Storage (JWT auth + RLS) for check-in photos, rather than routing uploads through the backend.

## Context

The check-in feature requires uploading 1–3 photos per check-in to Supabase Storage. Three upload approaches were evaluated.

## Alternatives Considered

- **Signed URL upload**: Client calls backend to get a pre-signed upload URL, uploads directly to Storage, then POSTs check-in with URLs. Rejected: adds an extra round-trip before any upload begins; no meaningful security benefit over RLS in V1, since RLS already constrains uploads to the authenticated user's path.
- **Backend proxy (multipart)**: Client sends photos as `multipart/form-data` through Next.js → FastAPI, which handles Storage upload and check-in creation in one request. Rejected: routes large binary files through two servers (memory pressure, latency), violates the thin-proxy rule, and adds unnecessary backend complexity.

## Rationale

Direct upload with Supabase Storage RLS is the standard Supabase pattern. The RLS policy (`{user_id}/*` path restriction) provides the same access control as signed URLs with zero extra round-trips. The existing `POST /checkins` API already accepts `photo_urls[]` — no backend changes needed for the storage layer. This keeps the backend thin and eliminates file-routing overhead.

## Consequences

- **Advantage**: No files routed through the backend; fast, no memory pressure on Railway instances.
- **Advantage**: No new backend endpoint needed for upload authorization.
- **Advantage**: PDPA deletion is straightforward — cascade `{user_id}/` path in Storage on account deletion.
- **Disadvantage**: No server-side image resizing or validation at upload time. Mitigated by client-side validation (max 5 MB, image types only).
- **Disadvantage**: Photo URLs are UUID-based (not guessable) but not cryptographically protected — any authenticated user with a URL can access it. Acceptable for V1; revisit if fine-grained photo access control is needed.
