-- =============================================================================
-- OPA Group of India – Air Jet Loom ERP
-- Migration 005: Maintenance & HR (requests, work orders, PM schedules,
-- checklists, completions, employees, attendance)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_maint_priority') THEN
    CREATE TYPE opa_maint_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_maint_status') THEN
    CREATE TYPE opa_maint_status AS ENUM (
      'OPEN',
      'ASSIGNED',
      'IN_PROGRESS',
      'ON_HOLD',
      'COMPLETED',
      'CANCELLED',
      'CLOSED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_pm_frequency') THEN
    CREATE TYPE opa_pm_frequency AS ENUM (
      'DAILY',
      'WEEKLY',
      'MONTHLY',
      'QUARTERLY',
      'HALF_YEARLY',
      'YEARLY'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_attendance_status') THEN
    CREATE TYPE opa_attendance_status AS ENUM (
      'PRESENT',
      'ABSENT',
      'HALF_DAY',
      'LEAVE',
      'HOLIDAY',
      'WEEK_OFF'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Maintenance requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL,
  loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL,
  reported_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  request_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  issue_type TEXT,
  description TEXT NOT NULL,
  priority opa_maint_priority NOT NULL DEFAULT 'MEDIUM',
  status opa_maint_status NOT NULL DEFAULT 'OPEN',
  downtime_started_at TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_maintenance_requests_number_unique UNIQUE (request_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_maint_requests_status ON opa_maintenance_requests (status);
CREATE INDEX IF NOT EXISTS idx_opa_maint_requests_loom ON opa_maintenance_requests (loom_id);
CREATE INDEX IF NOT EXISTS idx_opa_maint_requests_priority ON opa_maintenance_requests (priority);

DROP TRIGGER IF EXISTS trg_opa_maintenance_requests_updated_at ON opa_maintenance_requests;
CREATE TRIGGER trg_opa_maintenance_requests_updated_at
  BEFORE UPDATE ON opa_maintenance_requests
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Work orders + spare usage
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_maintenance_work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number TEXT NOT NULL,
  request_id UUID REFERENCES opa_maintenance_requests (id) ON DELETE SET NULL,
  loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL,
  assigned_to UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  supervised_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  priority opa_maint_priority NOT NULL DEFAULT 'MEDIUM',
  status opa_maint_status NOT NULL DEFAULT 'OPEN',
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  work_description TEXT,
  root_cause TEXT,
  resolution TEXT,
  labour_hours NUMERIC(8, 2) DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_maintenance_work_orders_number_unique UNIQUE (wo_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_maint_wo_status ON opa_maintenance_work_orders (status);
CREATE INDEX IF NOT EXISTS idx_opa_maint_wo_loom ON opa_maintenance_work_orders (loom_id);
CREATE INDEX IF NOT EXISTS idx_opa_maint_wo_assigned ON opa_maintenance_work_orders (assigned_to);

DROP TRIGGER IF EXISTS trg_opa_maintenance_work_orders_updated_at ON opa_maintenance_work_orders;
CREATE TRIGGER trg_opa_maintenance_work_orders_updated_at
  BEFORE UPDATE ON opa_maintenance_work_orders
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_maintenance_spare_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID NOT NULL REFERENCES opa_maintenance_work_orders (id) ON DELETE CASCADE,
  spare_part_id UUID REFERENCES opa_spare_parts (id) ON DELETE SET NULL,
  inventory_item_id UUID REFERENCES opa_inventory_items (id) ON DELETE SET NULL,
  quantity NUMERIC(14, 3) NOT NULL,
  uom TEXT NOT NULL DEFAULT 'PCS',
  unit_cost NUMERIC(14, 4) DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_maint_spare_wo ON opa_maintenance_spare_usage (work_order_id);

DROP TRIGGER IF EXISTS trg_opa_maintenance_spare_usage_updated_at ON opa_maintenance_spare_usage;
CREATE TRIGGER trg_opa_maintenance_spare_usage_updated_at
  BEFORE UPDATE ON opa_maintenance_spare_usage
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- PM schedules, checklists, completions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_pm_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_code TEXT NOT NULL,
  name TEXT NOT NULL,
  loom_id UUID REFERENCES opa_looms (id) ON DELETE CASCADE,
  loom_type opa_loom_type,
  frequency opa_pm_frequency NOT NULL DEFAULT 'MONTHLY',
  next_due_date DATE,
  last_completed_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  estimated_hours NUMERIC(8, 2) DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_pm_schedules_code_unique UNIQUE (schedule_code)
);

CREATE INDEX IF NOT EXISTS idx_opa_pm_schedules_due ON opa_pm_schedules (next_due_date);
CREATE INDEX IF NOT EXISTS idx_opa_pm_schedules_loom ON opa_pm_schedules (loom_id);

DROP TRIGGER IF EXISTS trg_opa_pm_schedules_updated_at ON opa_pm_schedules;
CREATE TRIGGER trg_opa_pm_schedules_updated_at
  BEFORE UPDATE ON opa_pm_schedules
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_pm_checklists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES opa_pm_schedules (id) ON DELETE CASCADE,
  item_code TEXT,
  item_name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_mandatory BOOLEAN NOT NULL DEFAULT TRUE,
  applies_to_loom_type opa_loom_type,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_pm_checklists_schedule ON opa_pm_checklists (schedule_id);
CREATE INDEX IF NOT EXISTS idx_opa_pm_checklists_sort ON opa_pm_checklists (sort_order);

DROP TRIGGER IF EXISTS trg_opa_pm_checklists_updated_at ON opa_pm_checklists;
CREATE TRIGGER trg_opa_pm_checklists_updated_at
  BEFORE UPDATE ON opa_pm_checklists
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_pm_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  completion_number TEXT NOT NULL,
  schedule_id UUID NOT NULL REFERENCES opa_pm_schedules (id) ON DELETE RESTRICT,
  loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL,
  completed_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checklist_results JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  remarks TEXT,
  next_due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_pm_completions_number_unique UNIQUE (completion_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_pm_completions_schedule ON opa_pm_completions (schedule_id);
CREATE INDEX IF NOT EXISTS idx_opa_pm_completions_at ON opa_pm_completions (completed_at DESC);

DROP TRIGGER IF EXISTS trg_opa_pm_completions_updated_at ON opa_pm_completions;
CREATE TRIGGER trg_opa_pm_completions_updated_at
  BEFORE UPDATE ON opa_pm_completions
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Employees
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  profile_id UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  department_id UUID REFERENCES opa_departments (id) ON DELETE SET NULL,
  designation TEXT,
  role opa_role,
  mobile TEXT,
  email TEXT,
  date_of_joining DATE,
  date_of_exit DATE,
  shift_id UUID REFERENCES opa_shifts (id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_employees_code_unique UNIQUE (employee_code)
);

CREATE INDEX IF NOT EXISTS idx_opa_employees_department ON opa_employees (department_id);
CREATE INDEX IF NOT EXISTS idx_opa_employees_active ON opa_employees (is_active);
CREATE INDEX IF NOT EXISTS idx_opa_employees_profile ON opa_employees (profile_id);

DROP TRIGGER IF EXISTS trg_opa_employees_updated_at ON opa_employees;
CREATE TRIGGER trg_opa_employees_updated_at
  BEFORE UPDATE ON opa_employees
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES opa_employees (id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  shift_id UUID REFERENCES opa_shifts (id) ON DELETE SET NULL,
  status opa_attendance_status NOT NULL DEFAULT 'PRESENT',
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  overtime_hours NUMERIC(6, 2) DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_attendance_employee_date_unique UNIQUE (employee_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_opa_attendance_date ON opa_attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_opa_attendance_employee ON opa_attendance (employee_id);
CREATE INDEX IF NOT EXISTS idx_opa_attendance_shift ON opa_attendance (shift_id);

DROP TRIGGER IF EXISTS trg_opa_attendance_updated_at ON opa_attendance;
CREATE TRIGGER trg_opa_attendance_updated_at
  BEFORE UPDATE ON opa_attendance
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

ALTER TABLE opa_maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_maintenance_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_maintenance_spare_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_pm_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_pm_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_pm_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_attendance ENABLE ROW LEVEL SECURITY;
