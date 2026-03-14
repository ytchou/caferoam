-- Add city column for filtering shops by city
-- Referenced in backend/api/shops.py _SHOP_COLUMNS but was missing from schema
ALTER TABLE shops ADD COLUMN IF NOT EXISTS city TEXT;
