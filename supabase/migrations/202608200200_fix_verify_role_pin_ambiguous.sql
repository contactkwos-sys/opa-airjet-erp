-- Fix ambiguous "role" in opa_verify_role_pin UPDATEs.
-- RETURNS TABLE(... role opa_role ...) creates a PL/pgSQL variable that
-- conflicts with unqualified "WHERE role = p_role" (PG 42702).

CREATE OR REPLACE FUNCTION opa_verify_role_pin(p_role opa_role, p_pin text)
RETURNS TABLE (
  ok boolean,
  auth_email text,
  full_name text,
  role opa_role,
  locked boolean
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
  v_failed integer;
  v_locked_until timestamptz;
BEGIN
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN
    RETURN QUERY SELECT FALSE, NULL::text, NULL::text, NULL::opa_role, FALSE;
    RETURN;
  END IF;

  SELECT r.pin_hash, r.auth_email, r.label, r.is_active, r.failed_attempts, r.locked_until
    INTO v_hash, v_email, v_label, v_active, v_failed, v_locked_until
  FROM opa_role_pins r
  WHERE r.role = p_role;

  IF NOT FOUND OR v_active IS DISTINCT FROM TRUE THEN
    RETURN QUERY SELECT FALSE, NULL::text, NULL::text, NULL::opa_role, FALSE;
    RETURN;
  END IF;

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN QUERY SELECT FALSE, NULL::text, NULL::text, NULL::opa_role, TRUE;
    RETURN;
  END IF;

  IF crypt(p_pin, v_hash) = v_hash THEN
    UPDATE opa_role_pins AS r
       SET failed_attempts = 0,
           locked_until = NULL
     WHERE r.role = p_role;
    RETURN QUERY SELECT TRUE, v_email, v_label, p_role, FALSE;
  ELSE
    v_failed := COALESCE(v_failed, 0) + 1;
    UPDATE opa_role_pins AS r
       SET failed_attempts = v_failed,
           locked_until = CASE WHEN v_failed >= 5 THEN now() + interval '30 minutes' ELSE NULL END
     WHERE r.role = p_role;
    RETURN QUERY SELECT FALSE, NULL::text, NULL::text, NULL::opa_role, (v_failed >= 5);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION opa_verify_role_pin(opa_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_verify_role_pin(opa_role, text) TO service_role;
