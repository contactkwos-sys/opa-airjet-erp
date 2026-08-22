-- Harden CEO / Director PIN login:
-- 1) Named employee logins only (deactivate colliding role-level PINs)
-- 2) Re-seed CEO 3501 / Director 3502 and clear lockouts
-- Role-level auth_email pin.ceo@opa.internal collided with the CEO employee row.

UPDATE opa_role_pins
   SET is_active = FALSE,
       label = CASE
         WHEN role = 'CEO'::opa_role THEN 'CEO (named login on /login)'
         WHEN role = 'DIRECTOR'::opa_role THEN 'Director (named login on /login)'
         ELSE label
       END,
       failed_attempts = 0,
       locked_until = NULL,
       updated_at = now()
 WHERE role IN ('CEO'::opa_role, 'DIRECTOR'::opa_role);

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

-- Clear any lockout on the named CEO / Director rows (including legacy COMPANY_ADMIN copies).
UPDATE opa_pin_employees
   SET failed_attempts = 0,
       locked_until = NULL,
       updated_at = now()
 WHERE display_name IN ('CEO', 'Director')
   AND role IN (
     'CEO'::opa_role,
     'DIRECTOR'::opa_role,
     'COMPANY_ADMIN'::opa_role
   );
