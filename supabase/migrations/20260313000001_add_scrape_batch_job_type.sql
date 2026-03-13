-- Add scrape_batch to the job_queue job_type constraint.
-- SCRAPE_BATCH was added to the Python JobType enum and handler
-- but the DB CHECK constraint was never updated.
ALTER TABLE job_queue DROP CONSTRAINT IF EXISTS job_queue_job_type_check;
ALTER TABLE job_queue ADD CONSTRAINT job_queue_job_type_check
  CHECK (job_type IN (
    'enrich_shop', 'enrich_menu_photo', 'generate_embedding',
    'staleness_sweep', 'weekly_email',
    'scrape_shop', 'scrape_batch', 'publish_shop', 'admin_digest_email'
  ));
