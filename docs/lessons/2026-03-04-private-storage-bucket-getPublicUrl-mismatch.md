# Private Supabase Storage Bucket + getPublicUrl = Silent Broken Images

**Date:** 2026-03-04
**Context:** check-in photos feature (feat/checkin-stamps)

## What happened

Storage buckets were created with `public = false`. The upload utility called `supabase.storage.from(bucket).getPublicUrl(path)` to generate URLs that were stored in the DB and rendered in `<img>` tags. This produced syntactically valid URLs that returned 403 silently — browser `<img>` requests don't carry Supabase auth headers, so even authenticated users couldn't view photos.

## Root cause

`getPublicUrl()` constructs a URL regardless of bucket visibility. On a private bucket, the URL is structurally correct but access-denied at the CDN level. The mismatch is not caught in tests (tests mock both `upload` and `getPublicUrl`).

## Prevention

- **If photos must be publicly viewable** (in `<img>` tags, shared links, unauthenticated previews): create the bucket with `public = true`. The upload RLS policies still protect write access.
- **If photos must be private** (only accessible via authenticated API): use `createSignedUrl()` with an expiry, not `getPublicUrl()`. Never store `getPublicUrl()` results as permanent URLs for private buckets.
- **Rule of thumb**: if you use `getPublicUrl()`, the bucket must be `public = true`.
