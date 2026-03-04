# RLS Policies: INSERT does not imply UPDATE

**Date:** 2026-03-04
**Context:** Reviews feature — PATCH /checkins/{id}/review was silently returning 404 for all users despite correct application logic.

**What happened:**
RLS SELECT and INSERT policies were created for `check_ins` in the initial migration. When the reviews feature added a PATCH endpoint, no UPDATE policy was added. Supabase silently returns empty `data=[]` on UPDATE when RLS blocks the operation — indistinguishable from "row not found" at the application level.

**Root cause:**
The review migration added columns and application code for PATCH, but did not check whether a corresponding RLS UPDATE policy existed. The initial RLS migration only had SELECT and INSERT.

**Prevention:**
When adding any write endpoint (PATCH, PUT, DELETE), always check `supabase/migrations/*_create_rls_policies.sql` for a corresponding `FOR UPDATE`/`FOR DELETE` policy. Add the policy in the same migration as the feature's schema changes, not as a separate migration.

Rule: one migration per feature — schema columns + RLS policies together.
