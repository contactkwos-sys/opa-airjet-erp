-- =============================================================================
-- OPA Group of India – Air Jet Loom ERP
-- Migration 001: Core schema (company, departments, shifts, roles, profiles,
-- permissions, audit, notifications, documents, approvals, alerts)
-- Prefix: opa_ | Idempotent where possible | Does not alter non-opa tables
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger helper
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION opa_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Roles enum
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_role') THEN
    CREATE TYPE opa_role AS ENUM (
      'SUPER_ADMIN',
      'CEO',
      'DIRECTOR',
      'FACTORY_MANAGER',
      'PRODUCTION_MANAGER',
      'PRODUCTION_SUPERVISOR',
      'LOOM_OPERATOR',
      'MAINTENANCE_HEAD',
      'TECHNICIAN',
      'STORE_MANAGER',
      'PURCHASE_MANAGER',
      'SALES_MANAGER',
      'ACCOUNTS',
      'HR',
      'SECURITY_HEAD',
      'SECURITY_GUARD',
      'QUALITY_MANAGER'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Company settings
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_company_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL DEFAULT 'OPA GROUP OF INDIA',
  logo_url TEXT,
  address TEXT,
  gstin TEXT,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  currency TEXT NOT NULL DEFAULT 'INR',
  fiscal_year TEXT,
  loom_count INTEGER NOT NULL DEFAULT 72,
  dobby_count INTEGER NOT NULL DEFAULT 36,
  plain_count INTEGER NOT NULL DEFAULT 36,
  costing_formulas JSONB NOT NULL DEFAULT '{}'::jsonb,
  approval_thresholds JSONB NOT NULL DEFAULT '{}'::jsonb,
  whatsapp_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

DROP TRIGGER IF EXISTS trg_opa_company_settings_updated_at ON opa_company_settings;
CREATE TRIGGER trg_opa_company_settings_updated_at
  BEFORE UPDATE ON opa_company_settings
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Departments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_departments_code_unique UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_opa_departments_active ON opa_departments (is_active);

DROP TRIGGER IF EXISTS trg_opa_departments_updated_at ON opa_departments;
CREATE TRIGGER trg_opa_departments_updated_at
  BEFORE UPDATE ON opa_departments
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Shifts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_shifts_code_unique UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_opa_shifts_active ON opa_shifts (is_active);

DROP TRIGGER IF EXISTS trg_opa_shifts_updated_at ON opa_shifts;
CREATE TRIGGER trg_opa_shifts_updated_at
  BEFORE UPDATE ON opa_shifts
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- Seed SHIFT A/B/C (idempotent)
INSERT INTO opa_shifts (code, name, start_time, end_time, is_active)
VALUES
  ('A', 'SHIFT A', '06:00', '14:00', TRUE),
  ('B', 'SHIFT B', '14:00', '22:00', TRUE),
  ('C', 'SHIFT C', '22:00', '06:00', TRUE)
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Profiles (extends auth.users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role opa_role NOT NULL DEFAULT 'LOOM_OPERATOR',
  department_id UUID REFERENCES opa_departments (id) ON DELETE SET NULL,
  employee_id TEXT,
  mobile TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_profiles_email_unique UNIQUE (email),
  CONSTRAINT opa_profiles_employee_id_unique UNIQUE (employee_id)
);

CREATE INDEX IF NOT EXISTS idx_opa_profiles_role ON opa_profiles (role);
CREATE INDEX IF NOT EXISTS idx_opa_profiles_department ON opa_profiles (department_id);
CREATE INDEX IF NOT EXISTS idx_opa_profiles_active ON opa_profiles (is_active);

DROP TRIGGER IF EXISTS trg_opa_profiles_updated_at ON opa_profiles;
CREATE TRIGGER trg_opa_profiles_updated_at
  BEFORE UPDATE ON opa_profiles
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Role permissions matrix
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role opa_role NOT NULL,
  module TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT FALSE,
  can_create BOOLEAN NOT NULL DEFAULT FALSE,
  can_edit BOOLEAN NOT NULL DEFAULT FALSE,
  can_delete BOOLEAN NOT NULL DEFAULT FALSE,
  can_approve BOOLEAN NOT NULL DEFAULT FALSE,
  can_export BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_role_permissions_role_module_unique UNIQUE (role, module)
);

CREATE INDEX IF NOT EXISTS idx_opa_role_permissions_module ON opa_role_permissions (module);

DROP TRIGGER IF EXISTS trg_opa_role_permissions_updated_at ON opa_role_permissions;
CREATE TRIGGER trg_opa_role_permissions_updated_at
  BEFORE UPDATE ON opa_role_permissions
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit logs (append-only for normal users)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_name TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id UUID,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opa_audit_logs_module ON opa_audit_logs (module);
CREATE INDEX IF NOT EXISTS idx_opa_audit_logs_user ON opa_audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_opa_audit_logs_created ON opa_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_opa_audit_logs_record ON opa_audit_logs (module, record_id);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES opa_profiles (id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  link TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_notifications_user ON opa_notifications (user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_opa_notifications_created ON opa_notifications (created_at DESC);

DROP TRIGGER IF EXISTS trg_opa_notifications_updated_at ON opa_notifications;
CREATE TRIGGER trg_opa_notifications_updated_at
  BEFORE UPDATE ON opa_notifications
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Documents / attachments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  record_id UUID NOT NULL,
  file_name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  uploaded_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_documents_module_record ON opa_documents (module, record_id);

DROP TRIGGER IF EXISTS trg_opa_documents_updated_at ON opa_documents;
CREATE TRIGGER trg_opa_documents_updated_at
  BEFORE UPDATE ON opa_documents
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Approvals workflow
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_approval_status') THEN
    CREATE TYPE opa_approval_status AS ENUM (
      'PENDING',
      'APPROVED',
      'REJECTED',
      'CANCELLED'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS opa_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module TEXT NOT NULL,
  record_id UUID NOT NULL,
  level INTEGER NOT NULL DEFAULT 1,
  status opa_approval_status NOT NULL DEFAULT 'PENDING',
  requested_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  notes TEXT,
  threshold_amount NUMERIC(14, 2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_approvals_module_record ON opa_approvals (module, record_id);
CREATE INDEX IF NOT EXISTS idx_opa_approvals_status ON opa_approvals (status);

DROP TRIGGER IF EXISTS trg_opa_approvals_updated_at ON opa_approvals;
CREATE TRIGGER trg_opa_approvals_updated_at
  BEFORE UPDATE ON opa_approvals
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- System alerts
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_alert_severity') THEN
    CREATE TYPE opa_alert_severity AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS opa_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  severity opa_alert_severity NOT NULL DEFAULT 'MEDIUM',
  title TEXT NOT NULL,
  body TEXT,
  module TEXT,
  record_id UUID,
  is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_alerts_unresolved ON opa_alerts (is_resolved, severity);
CREATE INDEX IF NOT EXISTS idx_opa_alerts_module ON opa_alerts (module, record_id);

DROP TRIGGER IF EXISTS trg_opa_alerts_updated_at ON opa_alerts;
CREATE TRIGGER trg_opa_alerts_updated_at
  BEFORE UPDATE ON opa_alerts
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- Enable RLS (policies defined in 008)
ALTER TABLE opa_company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_alerts ENABLE ROW LEVEL SECURITY;
