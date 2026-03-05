-- Performance indexes identified in pre-Phase 2B progress review (2026-03-05)

-- Prevents full-table scan when loading reviews on shop detail page
CREATE INDEX IF NOT EXISTS idx_shop_reviews_shop
  ON shop_reviews(shop_id);

-- Speeds pipeline state queries (find pending/failed shops)
CREATE INDEX IF NOT EXISTS idx_shops_processing_status
  ON shops(processing_status);

-- Speeds daily PDPA hard-delete scheduler (only scans marked profiles)
CREATE INDEX IF NOT EXISTS idx_profiles_deletion_requested
  ON profiles(deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL;

-- Speeds admin filtering and analytics by source
CREATE INDEX IF NOT EXISTS idx_shops_source
  ON shops(source);
