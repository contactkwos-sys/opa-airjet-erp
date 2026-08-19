-- Unify CEO / Director onto the main /login page (real CEO & DIRECTOR roles).
-- Day-to-day pin-admin tools accept CEO + DIRECTOR (same as former Company Admin).

-- ---------------------------------------------------------------------------
-- 1) Retire COMPANY_ADMIN named logins; seed CEO + DIRECTOR employees
-- ---------------------------------------------------------------------------
UPDATE opa_pin_employees
   SET is_active = FALSE,
       updated_at = now()
 WHERE role = 'COMPANY_ADMIN'::opa_role
   AND display_name IN ('CEO', 'Director', 'Aishwarya');

INSERT INTO opa_pin_employees (role, display_name, pin_hash, auth_email)
VALUES
  (
    'CEO',
    'CEO',
    extensions.crypt('3501', extensions.gen_salt('bf')),
    'pin.ceo@opa.internal'
  ),
  (
    'DIRECTOR',
    'Director',
    extensions.crypt('3502', extensions.gen_salt('bf')),
    'pin.director@opa.internal'
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

-- ---------------------------------------------------------------------------
-- 2) Pin-admin gate: CEO + Director + legacy COMPANY_ADMIN + Developer
-- ---------------------------------------------------------------------------
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
     OR v_profile.role NOT IN (
       'CEO'::opa_role,
       'DIRECTOR'::opa_role,
       'COMPANY_ADMIN'::opa_role,
       'SUPER_ADMIN'::opa_role
     ) THEN
    RAISE EXCEPTION 'Only CEO, Director, or Developer Override can perform this action';
  END IF;
  RETURN v_profile;
END;
$$;

REVOKE ALL ON FUNCTION opa_require_pin_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_require_pin_admin() TO authenticated;

CREATE OR REPLACE FUNCTION opa_is_protected_pin_role(p_role opa_role)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_role IN (
    'SUPER_ADMIN'::opa_role,
    'COMPANY_ADMIN'::opa_role,
    'CEO'::opa_role,
    'DIRECTOR'::opa_role
  );
$$;

DROP POLICY IF EXISTS opa_pin_change_history_pin_admin_select ON opa_pin_change_history;
CREATE POLICY opa_pin_change_history_pin_admin_select ON opa_pin_change_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM opa_profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = TRUE
        AND p.role IN (
          'CEO'::opa_role,
          'DIRECTOR'::opa_role,
          'COMPANY_ADMIN'::opa_role,
          'SUPER_ADMIN'::opa_role
        )
    )
  );

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
     OR e.role NOT IN (
       'SUPER_ADMIN'::opa_role,
       'COMPANY_ADMIN'::opa_role,
       'CEO'::opa_role,
       'DIRECTOR'::opa_role
     )
  ORDER BY e.role, e.display_name;
END;
$$;
