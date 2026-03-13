-- Batch job claiming RPC for concurrent per-type worker polling.
-- Replaces the single-job claim_job RPC for high-throughput job types.
-- Uses FOR UPDATE SKIP LOCKED so concurrent callers claim disjoint rows.
CREATE OR REPLACE FUNCTION claim_jobs_batch(p_job_type TEXT, p_limit INT DEFAULT 1)
RETURNS SETOF job_queue AS $$
  UPDATE job_queue
  SET status = 'claimed', claimed_at = now(), attempts = attempts + 1
  WHERE id IN (
    SELECT id FROM job_queue
    WHERE status = 'pending'
      AND scheduled_at <= now()
      AND job_type = p_job_type
    ORDER BY priority DESC, scheduled_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT p_limit
  )
  RETURNING *;
$$ LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public;
