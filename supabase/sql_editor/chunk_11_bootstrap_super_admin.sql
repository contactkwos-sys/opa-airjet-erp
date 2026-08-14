-- =============================================================================
-- Point 2 — Bootstrap SUPER_ADMIN for OPA AIR JET ERP
-- Project: rjpwznapyaegotbswlke (OPA AIR JET ERP / opa-airjet-erp)
-- DO NOT run on: ixulyhomqtajenigopai or "test-client-only"
-- =============================================================================
-- BEFORE THIS SQL:
-- 1. Open https://supabase.com/dashboard/project/rjpwznapyaegotbswlke/auth/users
-- 2. Click green "Add user" → "Create new user"
-- 3. Enter email + password, turn ON "Auto Confirm User", Create
-- 4. Copy that user's UID from the Users table
-- 5. Paste this file in SQL Editor and REPLACE the placeholders below
-- =============================================================================

-- Optional: allow logged-in API access (safe if already granted)
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'opa_profiles','opa_role_permissions','opa_departments','opa_shifts',
    'opa_looms','opa_products','opa_production_entries','opa_targets',
    'opa_inventory_items','opa_inventory_transactions','opa_yarn_lots',
    'opa_beams','opa_purchase_requisitions','opa_purchase_orders',
    'opa_sales_orders','opa_maintenance_requests','opa_maintenance_work_orders',
    'opa_employees','opa_notifications','opa_documents','opa_audit_logs',
    'visitor_requests','security_audit_logs'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', t);
    END IF;
  END LOOP;
END $$;

-- Replace BOTH placeholders, then Run:
--   YOUR_AUTH_USER_UUID  → UID from Auth → Users
--   your.email@domain.com → same email you created in Auth

INSERT INTO public.opa_profiles (
  id,
  email,
  full_name,
  role,
  employee_id,
  is_active,
  permissions
)
VALUES (
  'YOUR_AUTH_USER_UUID'::uuid,
  'your.email@domain.com',
  'OPA Super Admin',
  'SUPER_ADMIN'::opa_role,
  'SA-001',
  TRUE,
  '{}'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  role = 'SUPER_ADMIN'::opa_role,
  is_active = TRUE,
  updated_at = NOW();

-- Verify
SELECT id, email, full_name, role, is_active
FROM public.opa_profiles
WHERE role = 'SUPER_ADMIN';
