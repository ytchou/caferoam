-- Track pipeline batch runs for admin dashboard visibility.

-- rejection_reason on shops: explains why a shop was not published.
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- batch_runs: one row per script invocation.
CREATE TABLE IF NOT EXISTS public.batch_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id        TEXT UNIQUE NOT NULL,
    started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ,
    status          TEXT NOT NULL DEFAULT 'running'
                        CHECK (status IN ('running', 'completed', 'failed')),
    total           INT NOT NULL DEFAULT 0,
    scraped         INT NOT NULL DEFAULT 0,
    taiwan          INT NOT NULL DEFAULT 0,
    out_of_region   INT NOT NULL DEFAULT 0,
    not_found       INT NOT NULL DEFAULT 0,
    live            INT NOT NULL DEFAULT 0,
    errors          INT NOT NULL DEFAULT 0
);

-- batch_run_shops: one row per shop per batch run — for per-shop drill-down.
CREATE TABLE IF NOT EXISTS public.batch_run_shops (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_run_id        UUID NOT NULL REFERENCES public.batch_runs(id) ON DELETE CASCADE,
    shop_id             UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    shop_name           TEXT NOT NULL,
    started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at        TIMESTAMPTZ,
    status              TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'scraping', 'enriching', 'embedding',
                                              'publishing', 'live', 'out_of_region', 'not_found', 'error')),
    rejection_reason    TEXT,
    scrape_elapsed_s    NUMERIC(8,2),
    enrich_elapsed_s    NUMERIC(8,2),
    embed_elapsed_s     NUMERIC(8,2),
    publish_elapsed_s   NUMERIC(8,2),
    error_message       TEXT
);

CREATE INDEX IF NOT EXISTS idx_batch_run_shops_batch_run_id ON public.batch_run_shops(batch_run_id);
CREATE INDEX IF NOT EXISTS idx_batch_runs_status ON public.batch_runs(status);
