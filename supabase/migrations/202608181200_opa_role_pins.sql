-- OPA Air Jet ERP — role PIN login (KWOS-style)
-- PINs are stored as bcrypt hashes only. Never query pin_hash from the client.

CREATE TABLE IF NOT EXISTS opa_role_pins (
  role opa_role PRIMARY KEY,
  pin_hash TEXT NOT NULL,
  label TEXT NOT NULL,
  auth_email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_opa_role_pins_auth_email
  ON opa_role_pins (auth_email);

CREATE INDEX IF NOT EXISTS idx_opa_role_pins_active
  ON opa_role_pins (is_active)
  WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_opa_role_pins_updated_at ON opa_role_pins;
CREATE TRIGGER trg_opa_role_pins_updated_at
  BEFORE UPDATE ON opa_role_pins
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

ALTER TABLE opa_role_pins ENABLE ROW LEVEL SECURITY;

-- No direct client access to hashes. Edge function uses service role.
DROP POLICY IF EXISTS opa_role_pins_deny_all ON opa_role_pins;
CREATE POLICY opa_role_pins_deny_all ON opa_role_pins
  FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);

-- Public role list for the PIN login picker (no secrets).
CREATE OR REPLACE VIEW opa_pin_roles AS
SELECT
  role,
  label,
  is_active
FROM opa_role_pins
WHERE is_active = TRUE
ORDER BY label;

GRANT SELECT ON opa_pin_roles TO anon, authenticated;

-- Server-side PIN verify. SECURITY DEFINER; returns auth email on match only.
CREATE OR REPLACE FUNCTION opa_verify_role_pin(p_role opa_role, p_pin text)
RETURNS TABLE (
  ok boolean,
  auth_email text,
  full_name text,
  role opa_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash text;
  v_email text;
  v_label text;
  v_active boolean;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^\d{4}$' THEN
    RETURN QUERY SELECT FALSE, NULL::text, NULL::text, NULL::opa_role;
    RETURN;
  END IF;

  SELECT r.pin_hash, r.auth_email, r.label, r.is_active
    INTO v_hash, v_email, v_label, v_active
  FROM opa_role_pins r
  WHERE r.role = p_role;

  IF NOT FOUND OR v_active IS DISTINCT FROM TRUE THEN
    RETURN QUERY SELECT FALSE, NULL::text, NULL::text, NULL::opa_role;
    RETURN;
  END IF;

  IF crypt(p_pin, v_hash) = v_hash THEN
    RETURN QUERY SELECT TRUE, v_email, v_label, p_role;
  ELSE
    RETURN QUERY SELECT FALSE, NULL::text, NULL::text, NULL::opa_role;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION opa_verify_role_pin(opa_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_verify_role_pin(opa_role, text) TO service_role;

-- Seed role PIN rows.
-- Default PINs (ops reference only — rotate in production):
--   SUPER_ADMIN 9999 | FACTORY_MANAGER 1111 | PRODUCTION_MANAGER 2222
--   PRODUCTION_SUPERVISOR 3333 | LOOM_OPERATOR 4444 | MAINTENANCE_HEAD 5555
--   TECHNICIAN 5566 | STORE_MANAGER 6666 | PURCHASE_MANAGER 6677
--   SALES_MANAGER 7777 | ACCOUNTS 7788 | HR 8888 | QUALITY_MANAGER 8899
--   SECURITY_HEAD 1212 | SECURITY_GUARD 1313 | CEO 1414 | DIRECTOR 1515
INSERT INTO opa_role_pins (role, pin_hash, label, auth_email) VALUES
  ('SUPER_ADMIN',           crypt('9999', gen_salt('bf')), 'Super Admin',           'pin.super_admin@opa.internal'),
  ('CEO',                   crypt('1414', gen_salt('bf')), 'CEO',                   'pin.ceo@opa.internal'),
  ('DIRECTOR',              crypt('1515', gen_salt('bf')), 'Director',              'pin.director@opa.internal'),
  ('FACTORY_MANAGER',       crypt('1111', gen_salt('bf')), 'Plant Manager',         'pin.factory_manager@opa.internal'),
  ('PRODUCTION_MANAGER',    crypt('2222', gen_salt('bf')), 'Production Manager',    'pin.production_manager@opa.internal'),
  ('PRODUCTION_SUPERVISOR', crypt('3333', gen_salt('bf')), 'Production Supervisor', 'pin.production_supervisor@opa.internal'),
  ('LOOM_OPERATOR',         crypt('4444', gen_salt('bf')), 'Loom Operator',         'pin.loom_operator@opa.internal'),
  ('MAINTENANCE_HEAD',      crypt('5555', gen_salt('bf')), 'Maintenance Head',      'pin.maintenance_head@opa.internal'),
  ('TECHNICIAN',            crypt('5566', gen_salt('bf')), 'Technician',            'pin.technician@opa.internal'),
  ('STORE_MANAGER',         crypt('6666', gen_salt('bf')), 'Store Manager',         'pin.store_manager@opa.internal'),
  ('PURCHASE_MANAGER',      crypt('6677', gen_salt('bf')), 'Purchase Manager',      'pin.purchase_manager@opa.internal'),
  ('SALES_MANAGER',         crypt('7777', gen_salt('bf')), 'Sales Manager',         'pin.sales_manager@opa.internal'),
  ('ACCOUNTS',              crypt('7788', gen_salt('bf')), 'Accounts',              'pin.accounts@opa.internal'),
  ('HR',                    crypt('8888', gen_salt('bf')), 'HR',                    'pin.hr@opa.internal'),
  ('SECURITY_HEAD',         crypt('1212', gen_salt('bf')), 'Security Head',         'pin.security_head@opa.internal'),
  ('SECURITY_GUARD',        crypt('1313', gen_salt('bf')), 'Security',              'pin.security_guard@opa.internal'),
  ('QUALITY_MANAGER',       crypt('8899', gen_salt('bf')), 'Quality Manager',       'pin.quality_manager@opa.internal')
ON CONFLICT (role) DO NOTHING;
