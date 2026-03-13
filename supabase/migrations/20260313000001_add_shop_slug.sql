-- Add slug column for SEO-friendly URLs
ALTER TABLE shops ADD COLUMN slug TEXT;

-- Unique index (only on non-null slugs, so existing rows don't conflict)
CREATE UNIQUE INDEX idx_shops_slug ON shops(slug) WHERE slug IS NOT NULL;
