-- Split Super Admin into Company Admin (day-to-day PIN/employee mgmt)
-- and Developer Override (SUPER_ADMIN — emergency / technical only).
-- Requires 202608200050_company_admin_role_enum.sql (COMPANY_ADMIN enum) first.

-- ---------------------------------------------------------------------------
-- 1) Gate helpers
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
    RAISE EXCEPTION 'Only Developer Override can perform this action';
  END IF;
  RETURN v_profile;
END;
$$;

CREATE OR REPLACE FUNCTION opa_require_pin_admin()
RETURNS opa_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_profile opa_profiles;
BEGIN
  SELECT * INTO v_profile FROM opa_profiles WHERE id = auth.uid();
  IF v_profile.id IS NULL
     OR v_profile.is_active IS DISTINCT FROM TRUE
     OR v_profile.role NOT IN ('COMPANY_ADMIN'::opa_role, 'SUPER_ADMIN'::opa_role) THEN
    RAISE EXCEPTION 'Only Company Admin or Developer Override can perform this action';
  END IF;
  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION opa_require_pin_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_require_pin_admin() TO authenticated;

-- Roles Company Admin must not create/manage (developer-only identities).
CREATE OR REPLACE FUNCTION opa_is_protected_pin_role(p_role opa_role)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_role IN ('SUPER_ADMIN'::opa_role, 'COMPANY_ADMIN'::opa_role);
$$;

-- ---------------------------------------------------------------------------
-- 3) History SELECT — Company Admin + Developer
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS opa_pin_change_history_super_admin_select ON opa_pin_change_history;
DROP POLICY IF EXISTS opa_pin_change_history_pin_admin_select ON opa_pin_change_history;
CREATE POLICY opa_pin_change_history_pin_admin_select ON opa_pin_change_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM opa_profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = TRUE
        AND p.role IN ('COMPANY_ADMIN'::opa_role, 'SUPER_ADMIN'::opa_role)
    )
  );

-- ---------------------------------------------------------------------------
-- 4) Company-admin RPCs (employee + routine PIN management)
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
  v_caller := opa_require_pin_admin();
  -- Company Admin cannot rotate developer / company-admin role PINs.
  IF v_caller.role = 'COMPANY_ADMIN'::opa_role AND opa_is_protected_pin_role(p_role) THEN
    RAISE EXCEPTION 'Company Admin cannot change protected role PINs';
  END IF;
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

-- Emergency reset remains Developer Override (SUPER_ADMIN) only.
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
  v_caller := opa_require_pin_admin();
  IF v_caller.role = 'COMPANY_ADMIN'::opa_role AND opa_is_protected_pin_role(p_role) THEN
    RAISE EXCEPTION 'Company Admin cannot create protected role accounts';
  END IF;
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
  v_caller := opa_require_pin_admin();
  IF p_pin IS NULL OR length(trim(p_pin)) = 0 THEN
    v_pin := opa_generate_temp_pin();
  ELSE
    v_pin := trim(p_pin);
  END IF;
  IF v_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'PIN must be exactly 4 digits';
  END IF;

  SELECT e.role, e.display_name INTO v_role, v_name
  FROM opa_pin_employees e
  WHERE e.id = p_employee_id AND e.is_active = TRUE;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  IF v_caller.role = 'COMPANY_ADMIN'::opa_role AND opa_is_protected_pin_role(v_role) THEN
    RAISE EXCEPTION 'Company Admin cannot reset protected role PINs';
  END IF;

  UPDATE opa_pin_employees
     SET pin_hash = crypt(v_pin, gen_salt('bf')),
         pin_updated_at = now(),
         updated_by = v_caller.id,
         failed_attempts = 0,
         locked_until = NULL
   WHERE id = p_employee_id AND is_active = TRUE;

  PERFORM opa_log_pin_change(
    'employee', v_role, p_employee_id, v_name, 'REGENERATE', v_caller.id, v_caller.full_name
  );
  RETURN v_pin;
END;
$$;

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
  v_caller := opa_require_pin_admin();

  SELECT e.role, e.display_name INTO v_role, v_name
  FROM opa_pin_employees e
  WHERE e.id = p_employee_id AND e.is_active = TRUE;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Employee not found';
  END IF;

  IF v_caller.role = 'COMPANY_ADMIN'::opa_role AND opa_is_protected_pin_role(v_role) THEN
    RAISE EXCEPTION 'Company Admin cannot remove protected role accounts';
  END IF;

  UPDATE opa_pin_employees
     SET is_active = FALSE,
         updated_by = v_caller.id
   WHERE id = p_employee_id AND is_active = TRUE;

  PERFORM opa_log_pin_change(
    'employee', v_role, p_employee_id, v_name, 'DEACTIVATE', v_caller.id, v_caller.full_name
  );
  RETURN TRUE;
END;
$$;

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
  PERFORM opa_require_pin_admin();
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
  v_caller := opa_require_pin_admin();
  IF p_subject_type = 'role' THEN
    SELECT r.role, r.label INTO v_role, v_name
    FROM opa_role_pins r
    WHERE r.role = p_subject_id::opa_role;
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'Role not found';
    END IF;
    IF v_caller.role = 'COMPANY_ADMIN'::opa_role AND opa_is_protected_pin_role(v_role) THEN
      RAISE EXCEPTION 'Company Admin cannot unlock protected role accounts';
    END IF;
    UPDATE opa_role_pins
       SET failed_attempts = 0,
           locked_until = NULL,
           updated_by = v_caller.id
     WHERE role = p_subject_id::opa_role;
    PERFORM opa_log_pin_change(
      'role', v_role, NULL, NULL, 'UNLOCK', v_caller.id, v_caller.full_name
    );
  ELSIF p_subject_type = 'employee' THEN
    SELECT e.role, e.display_name INTO v_role, v_name
    FROM opa_pin_employees e
    WHERE e.id = p_subject_id::uuid;
    IF v_role IS NULL THEN
      RAISE EXCEPTION 'Employee not found';
    END IF;
    IF v_caller.role = 'COMPANY_ADMIN'::opa_role AND opa_is_protected_pin_role(v_role) THEN
      RAISE EXCEPTION 'Company Admin cannot unlock protected role accounts';
    END IF;
    UPDATE opa_pin_employees
       SET failed_attempts = 0,
           locked_until = NULL,
           updated_by = v_caller.id
     WHERE id = p_subject_id::uuid;
    PERFORM opa_log_pin_change(
      'employee', v_role, p_subject_id::uuid, v_name, 'UNLOCK', v_caller.id, v_caller.full_name
    );
  ELSE
    RAISE EXCEPTION 'Invalid subject type';
  END IF;
  RETURN TRUE;
END;
$$;

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
DECLARE
  v_caller opa_profiles;
BEGIN
  v_caller := opa_require_pin_admin();
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
  WHERE v_caller.role = 'SUPER_ADMIN'::opa_role
     OR e.role NOT IN ('SUPER_ADMIN'::opa_role, 'COMPANY_ADMIN'::opa_role)
  ORDER BY e.role, e.display_name;
END;
$$;

-- ---------------------------------------------------------------------------
-- 5) Seed Company Admin named logins + developer role pin label
-- ---------------------------------------------------------------------------
-- Ops reference (rotate in production):
--   Company Admin — CEO 3501 | Director 3502
--   Developer Override (SUPER_ADMIN role PIN) — 7408  (was 9999; change after deploy)

INSERT INTO opa_role_pins (role, pin_hash, label, auth_email) VALUES
  (
    'COMPANY_ADMIN',
    extensions.crypt('0000', extensions.gen_salt('bf')),
    'Company Admin',
    'pin.company_admin@opa.internal'
  )
ON CONFLICT (role) DO NOTHING;

-- Keep COMPANY_ADMIN role-PIN inactive — login is named employees only.
UPDATE opa_role_pins
   SET is_active = FALSE,
       label = 'Company Admin (named logins only)'
 WHERE role = 'COMPANY_ADMIN';

UPDATE opa_role_pins
   SET label = 'Developer Override',
       pin_hash = extensions.crypt('7408', extensions.gen_salt('bf')),
       failed_attempts = 0,
       locked_until = NULL,
       updated_at = now()
 WHERE role = 'SUPER_ADMIN';

-- Rename legacy seed "Aishwarya" → "CEO" if an earlier draft was applied.
UPDATE opa_pin_employees
   SET display_name = 'CEO',
       auth_email = 'pin.company.ceo@opa.internal',
       pin_hash = extensions.crypt('3501', extensions.gen_salt('bf')),
       is_active = TRUE,
       failed_attempts = 0,
       locked_until = NULL,
       pin_updated_at = now(),
       updated_at = now()
 WHERE role = 'COMPANY_ADMIN'::opa_role
   AND display_name = 'Aishwarya';

INSERT INTO opa_pin_employees (role, display_name, pin_hash, auth_email)
VALUES
  (
    'COMPANY_ADMIN',
    'CEO',
    extensions.crypt('3501', extensions.gen_salt('bf')),
    'pin.company.ceo@opa.internal'
  ),
  (
    'COMPANY_ADMIN',
    'Director',
    extensions.crypt('3502', extensions.gen_salt('bf')),
    'pin.company.director@opa.internal'
  )
ON CONFLICT (role, display_name) DO UPDATE
SET
  pin_hash = EXCLUDED.pin_hash,
  auth_email = EXCLUDED.auth_email,
  is_active = TRUE,
  failed_attempts = 0,
  locked_until = NULL,
  pin_updated_at = now(),
  updated_at = now();

-- Module permissions for Company Admin (settings / PIN tools only — not full ERP).
INSERT INTO opa_role_permissions (role, module, can_view, can_create, can_edit, can_delete, can_approve, can_export)
SELECT
  'COMPANY_ADMIN'::opa_role,
  m.module,
  CASE WHEN m.module IN ('settings', 'dashboard') THEN TRUE ELSE FALSE END,
  CASE WHEN m.module = 'settings' THEN TRUE ELSE FALSE END,
  CASE WHEN m.module = 'settings' THEN TRUE ELSE FALSE END,
  FALSE,
  FALSE,
  CASE WHEN m.module = 'settings' THEN TRUE ELSE FALSE END
FROM (
  SELECT DISTINCT module FROM opa_role_permissions
) m
ON CONFLICT (role, module) DO UPDATE
SET
  can_view = EXCLUDED.can_view,
  can_create = EXCLUDED.can_create,
  can_edit = EXCLUDED.can_edit,
  can_delete = EXCLUDED.can_delete,
  can_approve = EXCLUDED.can_approve,
  can_export = EXCLUDED.can_export;
