-- =============================================================================
-- OPA Air Jet ERP — harden opa_profiles RLS
-- - Block cross-user SELECT for non-admin / non-HR roles
-- - Block self-service privilege escalation (role / is_active / permissions / …)
-- - Preserve SUPER_ADMIN (and elevated / HR admin) access
-- =============================================================================

-- Seed matrix sets can_view=TRUE for every role×module, so opa_has_permission('hr','view')
-- incorrectly allowed SECURITY_GUARD (and others) to read all profiles. Do not use hr.view
-- alone for directory access.

CREATE OR REPLACE FUNCTION opa_can_manage_profiles()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    opa_current_role() = 'SUPER_ADMIN'::opa_role
    OR opa_is_elevated()
    OR opa_current_role() = 'HR'::opa_role
    OR opa_has_permission('hr', 'edit'),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION opa_can_manage_profiles() TO authenticated;

-- Prevent non-admin users from changing privileged columns on their own row.
-- Runs for all UPDATEs (including when RLS would otherwise allow self-update).
CREATE OR REPLACE FUNCTION opa_profiles_guard_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role TEXT := COALESCE(auth.role(), '');
BEGIN
  -- Service role / backend Admin API writes may change privileged fields.
  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF opa_can_manage_profiles() THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.permissions IS DISTINCT FROM OLD.permissions
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
     OR NEW.department_id IS DISTINCT FROM OLD.department_id THEN
    RAISE EXCEPTION 'opa_profiles: privileged fields cannot be changed by this user'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opa_profiles_guard_privileged ON opa_profiles;
CREATE TRIGGER trg_opa_profiles_guard_privileged
  BEFORE UPDATE ON opa_profiles
  FOR EACH ROW
  EXECUTE PROCEDURE opa_profiles_guard_privileged_columns();

-- SELECT: own row, or profile managers (SUPER_ADMIN / elevated / HR / hr.edit)
DROP POLICY IF EXISTS opa_profiles_select ON opa_profiles;
CREATE POLICY opa_profiles_select ON opa_profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR opa_can_manage_profiles()
  );

-- Self-update: own row only; role must remain the caller's current role.
-- Privileged column changes are also blocked by trg_opa_profiles_guard_privileged.
DROP POLICY IF EXISTS opa_profiles_update_self ON opa_profiles;
CREATE POLICY opa_profiles_update_self ON opa_profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND (
      opa_can_manage_profiles()
      OR role = opa_current_role()
    )
  );

-- Admin / HR path (includes SUPER_ADMIN via opa_can_manage_profiles)
DROP POLICY IF EXISTS opa_profiles_admin ON opa_profiles;
CREATE POLICY opa_profiles_admin ON opa_profiles
  FOR ALL TO authenticated
  USING (opa_can_manage_profiles())
  WITH CHECK (opa_can_manage_profiles());
