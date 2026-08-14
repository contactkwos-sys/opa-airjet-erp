-- =============================================================================
-- OPA Group of India – Air Jet Loom ERP
-- Migration 007: Seed data (company, departments, shifts, stores, looms,
-- role permissions, default PM checklist items)
-- Idempotent: ON CONFLICT DO NOTHING
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Company settings
-- ---------------------------------------------------------------------------
INSERT INTO opa_company_settings (
  company_name,
  address,
  timezone,
  currency,
  fiscal_year,
  loom_count,
  dobby_count,
  plain_count,
  costing_formulas,
  approval_thresholds,
  whatsapp_settings
)
SELECT
  'OPA GROUP OF INDIA',
  'India',
  'Asia/Kolkata',
  'INR',
  'April-March',
  72,
  36,
  36,
  jsonb_build_object(
    'yarn_cost_per_kg', 0,
    'labour_cost_per_meter', 0,
    'power_cost_per_hour', 0,
    'overhead_pct', 0
  ),
  jsonb_build_object(
    'purchase_l1', 50000,
    'purchase_l2', 200000,
    'purchase_ceo', 500000
  ),
  jsonb_build_object(
    'ceo_visit_enabled', true,
    'notify_ceo_on_visit', true
  )
WHERE NOT EXISTS (SELECT 1 FROM opa_company_settings LIMIT 1);

-- ---------------------------------------------------------------------------
-- Departments
-- ---------------------------------------------------------------------------
INSERT INTO opa_departments (code, name, description) VALUES
  ('PROD', 'Production', 'Loom shed production'),
  ('MAINT', 'Maintenance', 'Mechanical & electronic maintenance'),
  ('STORE', 'Stores', 'Yarn, spare and general stores'),
  ('PUR', 'Purchase', 'Procurement'),
  ('SALES', 'Sales', 'Sales & dispatch'),
  ('QC', 'Quality', 'Quality assurance'),
  ('ACC', 'Accounts', 'Accounts & finance'),
  ('HR', 'Human Resources', 'HR & attendance'),
  ('SEC', 'Security', 'Gate & visitor security'),
  ('ADMIN', 'Administration', 'Factory administration')
ON CONFLICT (code) DO NOTHING;

-- Shifts A/B/C already seeded in 001; ensure present
INSERT INTO opa_shifts (code, name, start_time, end_time, is_active) VALUES
  ('A', 'SHIFT A', '06:00', '14:00', TRUE),
  ('B', 'SHIFT B', '14:00', '22:00', TRUE),
  ('C', 'SHIFT C', '22:00', '06:00', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Stores
-- ---------------------------------------------------------------------------
INSERT INTO opa_stores (code, name, store_type, location) VALUES
  ('YARN', 'YARN STORE', 'YARN', 'Main plant'),
  ('GREIGE', 'GREIGE STORE', 'GREIGE', 'Main plant'),
  ('SPARE', 'SPARE PARTS STORE', 'SPARES', 'Main plant'),
  ('GEN', 'GENERAL STORE', 'GENERAL', 'Main plant'),
  ('CHEM', 'CHEMICAL STORE', 'CHEMICAL', 'Main plant')
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 72 Looms: DOBBY 01-36, PLAIN 37-72
-- ---------------------------------------------------------------------------
INSERT INTO opa_looms (loom_number, loom_type, status, is_active)
SELECT
  CASE
    WHEN g <= 36 THEN 'DOBBY LOOM ' || LPAD(g::TEXT, 2, '0')
    ELSE 'PLAIN LOOM ' || LPAD(g::TEXT, 2, '0')
  END,
  CASE WHEN g <= 36 THEN 'DOBBY'::opa_loom_type ELSE 'PLAIN'::opa_loom_type END,
  'IDLE'::opa_loom_status,
  TRUE
FROM generate_series(1, 72) AS g
ON CONFLICT (loom_number) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Default role permissions by module
-- Modules: dashboard, production, looms, inventory, yarn, purchase, sales,
-- maintenance, quality, hr, security, accounts, settings, approvals, audit
-- ---------------------------------------------------------------------------
WITH modules AS (
  SELECT unnest(ARRAY[
    'dashboard', 'production', 'looms', 'inventory', 'yarn', 'purchase',
    'sales', 'maintenance', 'quality', 'hr', 'security', 'accounts',
    'settings', 'approvals', 'audit', 'documents', 'costing'
  ]) AS module
),
roles AS (
  SELECT unnest(enum_range(NULL::opa_role)) AS role
)
INSERT INTO opa_role_permissions (
  role, module, can_view, can_create, can_edit, can_delete, can_approve, can_export
)
SELECT
  r.role,
  m.module,
  TRUE AS can_view,
  CASE
    WHEN r.role IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR', 'FACTORY_MANAGER') THEN TRUE
    WHEN r.role = 'PRODUCTION_MANAGER' AND m.module IN ('production', 'looms', 'dashboard') THEN TRUE
    WHEN r.role = 'PRODUCTION_SUPERVISOR' AND m.module IN ('production', 'looms') THEN TRUE
    WHEN r.role = 'LOOM_OPERATOR' AND m.module IN ('production') THEN TRUE
    WHEN r.role = 'MAINTENANCE_HEAD' AND m.module IN ('maintenance', 'looms') THEN TRUE
    WHEN r.role = 'TECHNICIAN' AND m.module IN ('maintenance') THEN TRUE
    WHEN r.role = 'STORE_MANAGER' AND m.module IN ('inventory', 'yarn') THEN TRUE
    WHEN r.role = 'PURCHASE_MANAGER' AND m.module IN ('purchase') THEN TRUE
    WHEN r.role = 'SALES_MANAGER' AND m.module IN ('sales') THEN TRUE
    WHEN r.role = 'ACCOUNTS' AND m.module IN ('accounts', 'costing', 'purchase', 'sales') THEN TRUE
    WHEN r.role = 'HR' AND m.module IN ('hr') THEN TRUE
    WHEN r.role = 'SECURITY_HEAD' AND m.module IN ('security') THEN TRUE
    WHEN r.role = 'SECURITY_GUARD' AND m.module IN ('security') THEN TRUE
    WHEN r.role = 'QUALITY_MANAGER' AND m.module IN ('quality', 'production') THEN TRUE
    ELSE FALSE
  END AS can_create,
  CASE
    WHEN r.role IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR', 'FACTORY_MANAGER') THEN TRUE
    WHEN r.role = 'PRODUCTION_MANAGER' AND m.module IN ('production', 'looms', 'dashboard') THEN TRUE
    WHEN r.role = 'PRODUCTION_SUPERVISOR' AND m.module IN ('production', 'looms') THEN TRUE
    WHEN r.role = 'MAINTENANCE_HEAD' AND m.module IN ('maintenance', 'looms') THEN TRUE
    WHEN r.role = 'TECHNICIAN' AND m.module IN ('maintenance') THEN TRUE
    WHEN r.role = 'STORE_MANAGER' AND m.module IN ('inventory', 'yarn') THEN TRUE
    WHEN r.role = 'PURCHASE_MANAGER' AND m.module IN ('purchase') THEN TRUE
    WHEN r.role = 'SALES_MANAGER' AND m.module IN ('sales') THEN TRUE
    WHEN r.role = 'ACCOUNTS' AND m.module IN ('accounts', 'costing') THEN TRUE
    WHEN r.role = 'HR' AND m.module IN ('hr') THEN TRUE
    WHEN r.role = 'SECURITY_HEAD' AND m.module IN ('security') THEN TRUE
    WHEN r.role = 'SECURITY_GUARD' AND m.module IN ('security') THEN TRUE
    WHEN r.role = 'QUALITY_MANAGER' AND m.module IN ('quality') THEN TRUE
    ELSE FALSE
  END AS can_edit,
  CASE
    WHEN r.role IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR') THEN TRUE
    WHEN r.role = 'FACTORY_MANAGER' AND m.module NOT IN ('settings', 'audit') THEN TRUE
    ELSE FALSE
  END AS can_delete,
  CASE
    WHEN r.role IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR', 'FACTORY_MANAGER') THEN TRUE
    WHEN r.role IN ('PRODUCTION_MANAGER', 'PURCHASE_MANAGER', 'SALES_MANAGER', 'MAINTENANCE_HEAD', 'ACCOUNTS')
      AND m.module IN ('approvals', 'purchase', 'sales', 'production', 'maintenance', 'accounts') THEN TRUE
    ELSE FALSE
  END AS can_approve,
  CASE
    WHEN r.role IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR', 'FACTORY_MANAGER', 'ACCOUNTS') THEN TRUE
    WHEN r.role IN ('PRODUCTION_MANAGER', 'PURCHASE_MANAGER', 'SALES_MANAGER', 'STORE_MANAGER', 'QUALITY_MANAGER', 'HR') THEN TRUE
    ELSE FALSE
  END AS can_export
FROM roles r
CROSS JOIN modules m
ON CONFLICT (role, module) DO NOTHING;

-- Restrict LOOM_OPERATOR / SECURITY_GUARD view scope slightly via updates is optional;
-- matrix above already limits create/edit.

-- Settings & audit: only elevated roles can view
UPDATE opa_role_permissions
SET can_view = FALSE, can_create = FALSE, can_edit = FALSE, can_delete = FALSE, can_approve = FALSE, can_export = FALSE
WHERE module IN ('settings', 'audit')
  AND role NOT IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR', 'FACTORY_MANAGER');

UPDATE opa_role_permissions
SET can_view = TRUE, can_edit = (role = 'SUPER_ADMIN'), can_export = TRUE
WHERE module = 'settings'
  AND role IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR', 'FACTORY_MANAGER');

UPDATE opa_role_permissions
SET can_view = TRUE, can_export = TRUE
WHERE module = 'audit'
  AND role IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR', 'FACTORY_MANAGER');

-- ---------------------------------------------------------------------------
-- Default PM checklist items (global templates: schedule_id NULL)
-- ---------------------------------------------------------------------------
INSERT INTO opa_pm_checklists (item_code, item_name, description, sort_order, is_mandatory, is_active)
SELECT v.item_code, v.item_name, v.description, v.sort_order, TRUE, TRUE
FROM (
  VALUES
    ('PM-01', 'Check air pressure', 'Verify main air pressure within operating range', 10),
    ('PM-02', 'Lubricate bearings', 'Lubricate critical loom bearings per schedule', 20),
    ('PM-03', 'Inspect reed & healds', 'Check reed, healds and drop wires for damage', 30),
    ('PM-04', 'Check weft accumulator', 'Inspect weft feeder / accumulator function', 40),
    ('PM-05', 'Inspect nozzle & relay', 'Clean and inspect main / relay nozzles', 50),
    ('PM-06', 'Check electronic controller', 'Verify controller LEDs, alarms and backups', 60),
    ('PM-07', 'Dobby / cam inspection', 'Inspect dobby unit or cam mechanism (as applicable)', 70),
    ('PM-08', 'Motor & drive check', 'Check motor temperature, belts and couplings', 80),
    ('PM-09', 'Safety guards', 'Ensure all guards and emergency stops functional', 90),
    ('PM-10', 'Clean loom & surroundings', 'Housekeeping around loom and under-machine area', 100)
) AS v(item_code, item_name, description, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM opa_pm_checklists c WHERE c.item_code = v.item_code AND c.schedule_id IS NULL
);
