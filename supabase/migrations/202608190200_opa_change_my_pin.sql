-- Self-service employee PIN change + audit (SELF_CHANGE).
-- Employees identify via profile email ↔ opa_pin_employees.auth_email
-- (or profile.employee_id storing the pin-employee UUID).

CREATE OR REPLACE FUNCTION opa_resolve_my_pin_employee()
RETURNS TABLE (
  employee_id uuid,
  role opa_role,
  display_name text,
  auth_email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_email text;
  v_emp_code text;
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;

  SELECT p.email, p.employee_id
    INTO v_email, v_emp_code
  FROM opa_profiles p
  WHERE p.id = v_uid AND p.is_active = TRUE;

  IF v_email IS NULL THEN
    RETURN;
  END IF;

  -- Prefer exact UUID stored on profile.employee_id (new pin logins).
  IF v_emp_code IS NOT NULL AND v_emp_code ~* '^[0-9a-f-]{36}$' THEN
    RETURN QUERY
    SELECT e.id, e.role, e.display_name, e.auth_email
    FROM opa_pin_employees e
    WHERE e.id = v_emp_code::uuid AND e.is_active = TRUE
    LIMIT 1;
    IF FOUND THEN
      RETURN;
    END IF;
  END IF;

  -- Fallback: match auth email used by pin-login provisioning.
  RETURN QUERY
  SELECT e.id, e.role, e.display_name, e.auth_email
  FROM opa_pin_employees e
  WHERE e.auth_email = v_email AND e.is_active = TRUE
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION opa_resolve_my_pin_employee() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_resolve_my_pin_employee() TO authenticated;

CREATE OR REPLACE FUNCTION opa_change_my_pin(p_current_pin text, p_new_pin text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_emp opa_pin_employees%ROWTYPE;
  v_profile opa_profiles%ROWTYPE;
  v_hash text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_current_pin IS NULL OR p_current_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'Current PIN must be exactly 4 digits';
  END IF;
  IF p_new_pin IS NULL OR p_new_pin !~ '^[0-9]{4}$' THEN
    RAISE EXCEPTION 'New PIN must be exactly 4 digits';
  END IF;
  IF p_current_pin = p_new_pin THEN
    RAISE EXCEPTION 'New PIN must be different from current PIN';
  END IF;

  SELECT * INTO v_profile FROM opa_profiles WHERE id = v_uid;
  IF v_profile.id IS NULL OR v_profile.is_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT e.*
    INTO v_emp
  FROM opa_pin_employees e
  WHERE e.is_active = TRUE
    AND (
      e.auth_email = v_profile.email
      OR (
        v_profile.employee_id IS NOT NULL
        AND v_profile.employee_id ~* '^[0-9a-f-]{36}$'
        AND e.id = v_profile.employee_id::uuid
      )
    )
  LIMIT 1;

  IF v_emp.id IS NULL THEN
    RAISE EXCEPTION 'No personal PIN account is linked to this login';
  END IF;

  IF v_emp.locked_until IS NOT NULL AND v_emp.locked_until > now() THEN
    RAISE EXCEPTION 'Account is locked. Contact Super Admin to unlock';
  END IF;

  v_hash := v_emp.pin_hash;
  IF crypt(p_current_pin, v_hash) IS DISTINCT FROM v_hash THEN
    UPDATE opa_pin_employees
       SET failed_attempts = COALESCE(failed_attempts, 0) + 1,
           locked_until = CASE
             WHEN COALESCE(failed_attempts, 0) + 1 >= 5 THEN now() + interval '30 minutes'
             ELSE locked_until
           END
     WHERE id = v_emp.id;
    RAISE EXCEPTION 'Current PIN is incorrect';
  END IF;

  UPDATE opa_pin_employees
     SET pin_hash = crypt(p_new_pin, gen_salt('bf')),
         pin_updated_at = now(),
         updated_by = v_uid,
         failed_attempts = 0,
         locked_until = NULL
   WHERE id = v_emp.id;

  PERFORM opa_log_pin_change(
    'employee',
    v_emp.role,
    v_emp.id,
    v_emp.display_name,
    'SELF_CHANGE',
    v_uid,
    COALESCE(v_profile.full_name, v_emp.display_name)
  );

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION opa_change_my_pin(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION opa_change_my_pin(text, text) TO authenticated;
