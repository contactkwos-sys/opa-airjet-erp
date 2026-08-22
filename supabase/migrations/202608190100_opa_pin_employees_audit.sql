-- OPA Air Jet ERP — PIN lockout, audit history, emergency reset, named employees
-- PINs are bcrypt-hashed (pgcrypto crypt/bf). Plaintext never stored.

-- ---------------------------------------------------------------------------
-- 1) Role PIN lockout columns
-- ---------------------------------------------------------------------------
ALTER TABLE opa_role_pins
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- 2) Named employees under each role (individual PINs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_pin_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role opa_role NOT NULL,
  display_name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  auth_email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMPTZ,
  pin_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_pin_employees_name_len CHECK (char_length(trim(display_name)) >= 2),
  CONSTRAINT opa_pin_employees_role_name UNIQUE (role, display_name)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_opa_pin_employees_auth_email
  ON opa_pin_employees (auth_email);

CREATE INDEX IF NOT EXISTS idx_opa_pin_employees_role_active
  ON opa_pin_employees (role, is_active)
  WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS trg_opa_pin_employees_updated_at ON opa_pin_employees;
CREATE TRIGGER trg_opa_pin_employees_updated_at
  BEFORE UPDATE ON opa_pin_employees
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

ALTER TABLE opa_pin_employees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opa_pin_employees_deny_all ON opa_pin_employees;
CREATE POLICY opa_pin_employees_deny_all ON opa_pin_employees
  FOR ALL
  USING (FALSE)
  WITH CHECK (FALSE);

-- Public directory for login name picker (no hashes / secrets).
CREATE OR REPLACE VIEW opa_pin_employee_directory AS
SELECT
  id,
  role,
  display_name,
  is_active,
  pin_updated_at
FROM opa_pin_employees
WHERE is_active = TRUE
ORDER BY role, display_name;

GRANT SELECT ON opa_pin_employee_directory TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) PIN change / unlock audit log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_pin_change_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type TEXT NOT NULL CHECK (subject_type IN ('role', 'employee')),
  role opa_role NOT NULL,
  employee_id UUID,
  employee_name TEXT,
  action TEXT NOT NULL,
  changed_by UUID,
  changed_by_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opa_pin_change_history_created
  ON opa_pin_change_history (created_at DESC);

ALTER TABLE opa_pin_change_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS opa_pin_change_history_super_admin_select ON opa_pin_change_history;
CREATE POLICY opa_pin_change_history_super_admin_select ON opa_pin_change_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM opa_profiles p
      WHERE p.id = auth.uid() AND p.role = 'SUPER_ADMIN' AND p.is_active = TRUE
    )
  );

-- Inserts only via SECURITY DEFINER RPCs (no client write policies).
DROP POLICY IF EXISTS opa_pin_change_history_deny_write ON opa_pin_change_history;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION opa_require_super_admin()
RETURNS opa_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_profile opa_profiles;
BEGIN
  SELECT * INTO v_profile FROM opa_profiles WHERE id = auth.uid();
  IF v_profile.id IS NULL OR v_profile.role IS DISTINCT FROM 'SUPER_ADMIN' OR v_profile.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Only SUPER_ADMIN can perform this action';
  END IF;
  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION opa_generate_temp_pin()
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN lpad((floor(random() * 10000))::int::text, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION opa_log_pin_change(
  p_subject_type text,
  p_role opa_role,
  p_employee_id uuid,
  p_employee_name text,
  p_action text,
  p_changed_by uuid,
  p_changed_by_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO opa_pin_change_history (
    subject_type, role, employee_id, employee_name, action, changed_by, changed_by_name
  ) VALUES (
    p_subject_type, p_role, p_employee_id, p_employee_name, p_action, p_changed_by, p_changed_by_name
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4) Role PIN verify with lockout
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS opa_verify_role_pin(opa_role, text);

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
    UPDATE opa_role_pins
       SET failed_attempts = 0,
           locked_until = NULL
     WHERE role = p_role;
    RETURN QUERY SELECT TRUE, v_email, v_label, p_role, FALSE;
  ELSE
    v_failed := COALESCE(v_failed, 0) + 1;
    UPDATE opa_role_pins
       SET failed_attempts = v_failed,
           locked_until = CASE WHEN v_failed >= 5 THEN now() + interval '30 minutes' ELSE NULL END
     WHERE role = p_role;
    RETURN QUERY SELECT FALSE, NULL::text, NULL::text, NULL::opa_role, (v_failed >= 5);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION opa_verify_role_pin(opa_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_verify_role_pin(opa_role, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 5) Employee PIN verify with lockout
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION opa_verify_employee_pin(p_employee_id uuid, p_pin text)
RETURNS TABLE (
  ok boolean,
  auth_email text,
  full_name text,
  role opa_role,
  employee_id uuid,
  locked boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
  v_email text;
  v_name text;
  v_role opa_role;
  v_active boolean;
  v_failed integer;
  v_locked_until timestamptz;
BEGIN
  IF p_employee_id IS NULL OR p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN
    RETURN QUERY SELECT FALSE, NULL::text, NULL::text, NULL::opa_role, NULL::uuid, FALSE;
    RETURN;
  END IF;

  SELECT e.pin_hash, e.auth_email, e.display_name, e.role, e.is_active, e.failed_attempts, e.locked_until
    INTO v_hash, v_email, v_name, v_role, v_active, v_failed, v_locked_until
  FROM opa_pin_employees e
  WHERE e.id = p_employee_id;

  IF NOT FOUND OR v_active IS DISTINCT FROM TRUE THEN
    RETURN QUERY SELECT FALSE, NULL::text, NULL::text, NULL::opa_role, NULL::uuid, FALSE;
    RETURN;
  END IF;

  IF v_locked_until IS NOT NULL AND v_locked_until > now() THEN
    RETURN QUERY SELECT FALSE, NULL::text, NULL::text, NULL::opa_role, p_employee_id, TRUE;
    RETURN;
  END IF;

  IF crypt(p_pin, v_hash) = v_hash THEN
    UPDATE opa_pin_employees
       SET failed_attempts = 0,
           locked_until = NULL
     WHERE id = p_employee_id;
    RETURN QUERY SELECT TRUE, v_email, v_name, v_role, p_employee_id, FALSE;
  ELSE
    v_failed := COALESCE(v_failed, 0) + 1;
    UPDATE opa_pin_employees
       SET failed_attempts = v_failed,
           locked_until = CASE WHEN v_failed >= 5 THEN now() + interval '30 minutes' ELSE NULL END
     WHERE id = p_employee_id;
    RETURN QUERY SELECT FALSE, NULL::text, NULL::text, NULL::opa_role, p_employee_id, (v_failed >= 5);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION opa_verify_employee_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_verify_employee_pin(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 6) Set / emergency-reset role PIN (returns plaintext once when generated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION opa_set_role_pin(p_role opa_role, p_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller opa_profiles;
BEGIN
  v_caller := opa_require_super_admin();
  IF p_pin IS NULL OR p_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;
  UPDATE opa_role_pins
     SET pin_hash = crypt(p_pin, gen_salt('bf')),
         updated_at = now(),
         updated_by = auth.uid(),
         failed_attempts = 0,
         locked_until = NULL
   WHERE role = p_role AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role PIN row not found';
  END IF;
  PERFORM opa_log_pin_change(
    'role', p_role, NULL, NULL, 'SET', v_caller.id, v_caller.full_name
  );
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION opa_set_role_pin(opa_role, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_set_role_pin(opa_role, text) TO authenticated;

CREATE OR REPLACE FUNCTION opa_emergency_reset_role_pin(p_role opa_role)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller opa_profiles;
  v_pin text;
BEGIN
  v_caller := opa_require_super_admin();
  v_pin := opa_generate_temp_pin();
  UPDATE opa_role_pins
     SET pin_hash = crypt(v_pin, gen_salt('bf')),
         updated_at = now(),
         updated_by = auth.uid(),
         failed_attempts = 0,
         locked_until = NULL
   WHERE role = p_role AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Role PIN row not found';
  END IF;
  PERFORM opa_log_pin_change(
    'role', p_role, NULL, NULL, 'EMERGENCY_RESET', v_caller.id, v_caller.full_name
  );
  RETURN v_pin;
END;
$$;

REVOKE ALL ON FUNCTION opa_emergency_reset_role_pin(opa_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_emergency_reset_role_pin(opa_role) TO authenticated;

-- ---------------------------------------------------------------------------
-- 7) Employee CRUD / PIN set (plaintext returned once, never stored)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION opa_create_pin_employee(
  p_role opa_role,
  p_display_name text,
  p_pin text DEFAULT NULL
)
RETURNS TABLE (employee_id uuid, temporary_pin text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller opa_profiles;
  v_pin text;
  v_id uuid;
  v_email text;
  v_name text;
BEGIN
  v_caller := opa_require_super_admin();
  v_name := trim(p_display_name);
  IF v_name IS NULL OR char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'Employee name is required';
  END IF;
  IF p_pin IS NULL OR length(trim(p_pin)) = 0 THEN
    v_pin := opa_generate_temp_pin();
  ELSE
    v_pin := trim(p_pin);
  END IF;
  IF v_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;

  v_id := gen_random_uuid();
  v_email := 'pin.emp.' || replace(v_id::text, '-', '') || '@opa.internal';

  INSERT INTO opa_pin_employees (
    id, role, display_name, pin_hash, auth_email, created_by, updated_by, pin_updated_at
  ) VALUES (
    v_id, p_role, v_name, crypt(v_pin, gen_salt('bf')), v_email, v_caller.id, v_caller.id, now()
  );

  PERFORM opa_log_pin_change(
    'employee', p_role, v_id, v_name, 'CREATE', v_caller.id, v_caller.full_name
  );

  RETURN QUERY SELECT v_id, v_pin;
END;
$$;

REVOKE ALL ON FUNCTION opa_create_pin_employee(opa_role, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_create_pin_employee(opa_role, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION opa_set_employee_pin(
  p_employee_id uuid,
  p_pin text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller opa_profiles;
  v_pin text;
  v_role opa_role;
  v_name text;
BEGIN
  v_caller := opa_require_super_admin();
  IF p_pin IS NULL OR length(trim(p_pin)) = 0 THEN
    v_pin := opa_generate_temp_pin();
  ELSE
    v_pin := trim(p_pin);
  END IF;
  IF v_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;

  UPDATE opa_pin_employees
     SET pin_hash = crypt(v_pin, gen_salt('bf')),
         pin_updated_at = now(),
         updated_by = v_caller.id,
         failed_attempts = 0,
         locked_until = NULL
   WHERE id = p_employee_id AND is_active = TRUE
   RETURNING role, display_name INTO v_role, v_name;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  PERFORM opa_log_pin_change(
    'employee', v_role, p_employee_id, v_name, 'REGENERATE', v_caller.id, v_caller.full_name
  );
  RETURN v_pin;
END;
$$;

REVOKE ALL ON FUNCTION opa_set_employee_pin(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_set_employee_pin(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION opa_deactivate_pin_employee(p_employee_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller opa_profiles;
  v_role opa_role;
  v_name text;
BEGIN
  v_caller := opa_require_super_admin();
  UPDATE opa_pin_employees
     SET is_active = FALSE,
         updated_by = v_caller.id
   WHERE id = p_employee_id AND is_active = TRUE
   RETURNING role, display_name INTO v_role, v_name;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;
  PERFORM opa_log_pin_change(
    'employee', v_role, p_employee_id, v_name, 'DEACTIVATE', v_caller.id, v_caller.full_name
  );
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION opa_deactivate_pin_employee(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_deactivate_pin_employee(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 8) Locked accounts list + unlock
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION opa_list_locked_pin_accounts()
RETURNS TABLE (
  subject_type text,
  subject_id text,
  role opa_role,
  display_name text,
  failed_attempts integer,
  locked_until timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM opa_require_super_admin();
  RETURN QUERY
  SELECT * FROM (
    SELECT
      'role'::text AS subject_type,
      r.role::text AS subject_id,
      r.role,
      r.label AS display_name,
      r.failed_attempts,
      r.locked_until
    FROM opa_role_pins r
    WHERE r.locked_until IS NOT NULL AND r.locked_until > now()
    UNION ALL
    SELECT
      'employee'::text,
      e.id::text,
      e.role,
      e.display_name,
      e.failed_attempts,
      e.locked_until
    FROM opa_pin_employees e
    WHERE e.locked_until IS NOT NULL AND e.locked_until > now()
  ) locked
  ORDER BY locked.locked_until DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION opa_list_locked_pin_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_list_locked_pin_accounts() TO authenticated;

CREATE OR REPLACE FUNCTION opa_unlock_pin_account(
  p_subject_type text,
  p_subject_id text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_caller opa_profiles;
  v_role opa_role;
  v_name text;
BEGIN
  v_caller := opa_require_super_admin();
  IF p_subject_type = 'role' THEN
    UPDATE opa_role_pins
       SET failed_attempts = 0,
           locked_until = NULL,
           updated_by = v_caller.id
     WHERE role = p_subject_id::opa_role
     RETURNING role, label INTO v_role, v_name;
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'Role not found';
    END IF;
    PERFORM opa_log_pin_change(
      'role', v_role, NULL, NULL, 'UNLOCK', v_caller.id, v_caller.full_name
    );
  ELSIF p_subject_type = 'employee' THEN
    UPDATE opa_pin_employees
       SET failed_attempts = 0,
           locked_until = NULL,
           updated_by = v_caller.id
     WHERE id = p_subject_id::uuid
     RETURNING role, display_name INTO v_role, v_name;
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'Employee not found';
    END IF;
    PERFORM opa_log_pin_change(
      'employee', v_role, p_subject_id::uuid, v_name, 'UNLOCK', v_caller.id, v_caller.full_name
    );
  ELSE
    RAISE EXCEPTION 'Invalid subject type';
  END IF;
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION opa_unlock_pin_account(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_unlock_pin_account(text, text) TO authenticated;

-- Admin overview of employees (no PIN values).
CREATE OR REPLACE FUNCTION opa_list_pin_employees_admin()
RETURNS TABLE (
  id uuid,
  role opa_role,
  display_name text,
  is_active boolean,
  pin_updated_at timestamptz,
  failed_attempts integer,
  locked_until timestamptz,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM opa_require_super_admin();
  RETURN QUERY
  SELECT
    e.id,
    e.role,
    e.display_name,
    e.is_active,
    e.pin_updated_at,
    e.failed_attempts,
    e.locked_until,
    e.created_at
  FROM opa_pin_employees e
  ORDER BY e.role, e.display_name;
END;
$$;

REVOKE ALL ON FUNCTION opa_list_pin_employees_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_list_pin_employees_admin() TO authenticated;
