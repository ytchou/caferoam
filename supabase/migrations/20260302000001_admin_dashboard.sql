-- Add manually_edited_at to shops for pipeline replay protection
ALTER TABLE shops ADD COLUMN manually_edited_at TIMESTAMPTZ;

-- Audit log for admin actions
CREATE TABLE admin_audit_logs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id  UUID NOT NULL,
  action         TEXT NOT NULL,
  target_type    TEXT NOT NULL,
  target_id      TEXT,
  payload        JSONB,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_admin_audit_logs_admin ON admin_audit_logs (admin_user_id, created_at DESC);
CREATE INDEX idx_admin_audit_logs_target ON admin_audit_logs (target_type, target_id);

-- RLS: enable with no permissive policies — only service role can access
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- shops_with_low_confidence_tags: shops where max tag confidence < 0.5
CREATE OR REPLACE FUNCTION shops_with_low_confidence_tags()
RETURNS TABLE (shop_id uuid, shop_name text, max_confidence numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
    SELECT s.id AS shop_id, s.name AS shop_name, MAX(st.confidence) AS max_confidence
    FROM shops s
    JOIN shop_tags st ON st.shop_id = s.id
    GROUP BY s.id, s.name
    HAVING MAX(st.confidence) < 0.5
    ORDER BY MAX(st.confidence) ASC
    LIMIT 50;
$$;

-- SECURITY DEFINER — revoke public execute so only service role can call directly.
-- Authenticated users access this data only through the admin API endpoint.
REVOKE EXECUTE ON FUNCTION shops_with_low_confidence_tags() FROM PUBLIC;
