-- Hotfix: ensure pgcrypto is on search_path; Super Admin PIN rotation RPC.

CREATE OR REPLACE FUNCTION opa_verify_role_pin(p_role opa_role, p_pin text)
RETURNS TABLE (
  ok boolean,
  auth_email text,
  full_name text,
  role opa_role
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
  v_email text;
  v_label text;
  v_active boolean;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN
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

CREATE OR REPLACE FUNCTION opa_set_role_pin(p_role opa_role, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller_role opa_role;
BEGIN
  SELECT role INTO v_caller_role FROM opa_profiles WHERE id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Only SUPER_ADMIN can rotate role PINs';
  END IF;
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;
  UPDATE opa_role_pins
     SET pin_hash = crypt(p_pin, gen_salt('bf')),
         updated_at = now(),
         updated_by = auth.uid()
   WHERE role = p_role AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role PIN row not found';
  END IF;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION opa_set_role_pin(opa_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_set_role_pin(opa_role, text) TO authenticated;
