-- Add review columns to check_ins table
-- Reviews are optional metadata on check-ins (stars required for review, text optional)

ALTER TABLE check_ins
  ADD COLUMN stars SMALLINT CHECK (stars BETWEEN 1 AND 5),
  ADD COLUMN review_text TEXT,
  ADD COLUMN confirmed_tags TEXT[] DEFAULT '{}',
  ADD COLUMN reviewed_at TIMESTAMPTZ;

-- If review_text is present, stars must also be present
ALTER TABLE check_ins
  ADD CONSTRAINT check_review_requires_stars
  CHECK (stars IS NOT NULL OR review_text IS NULL);

-- Index for querying reviews by shop (GET /shops/{shop_id}/reviews)
CREATE INDEX idx_check_ins_shop_stars ON check_ins (shop_id, stars)
  WHERE stars IS NOT NULL;

COMMENT ON COLUMN check_ins.stars IS '1-5 star rating (required for review)';
COMMENT ON COLUMN check_ins.review_text IS 'Optional free-form review text';
COMMENT ON COLUMN check_ins.confirmed_tags IS 'Taxonomy tag IDs the user confirmed during review';
COMMENT ON COLUMN check_ins.reviewed_at IS 'When the review was added or last updated';
