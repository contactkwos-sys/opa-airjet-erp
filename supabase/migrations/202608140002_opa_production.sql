-- =============================================================================
-- OPA Group of India – Air Jet Loom ERP
-- Migration 002: Production (looms, articles, plans, entries, targets,
-- stoppages, quality inspections & defects)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_loom_type') THEN
    CREATE TYPE opa_loom_type AS ENUM ('DOBBY', 'PLAIN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_loom_status') THEN
    CREATE TYPE opa_loom_status AS ENUM (
      'RUNNING',
      'STOPPED',
      'BREAKDOWN',
      'MAINTENANCE',
      'IDLE'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_target_type') THEN
    CREATE TYPE opa_target_type AS ENUM ('DAILY', 'SHIFT', 'LOOM', 'MONTHLY');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_stoppage_reason') THEN
    CREATE TYPE opa_stoppage_reason AS ENUM (
      'WARP_BREAK',
      'WEFT_BREAK',
      'BEAM_CHANGE',
      'REED_CHANGE',
      'DOBBY_FAULT',
      'ELECTRONIC_FAULT',
      'MECHANICAL_FAULT',
      'POWER_FAILURE',
      'AIR_PRESSURE',
      'QUALITY_HOLD',
      'PLANNED_MAINTENANCE',
      'BREAKDOWN',
      'NO_BEAM',
      'NO_OPERATOR',
      'OTHER'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_plan_status') THEN
    CREATE TYPE opa_plan_status AS ENUM (
      'DRAFT',
      'APPROVED',
      'IN_PROGRESS',
      'COMPLETED',
      'CANCELLED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_qc_result') THEN
    CREATE TYPE opa_qc_result AS ENUM ('PASS', 'FAIL', 'HOLD', 'REWORK');
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Looms
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_looms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loom_number TEXT NOT NULL,
  loom_type opa_loom_type NOT NULL,
  make TEXT,
  model TEXT,
  serial_number TEXT,
  installation_date DATE,
  width NUMERIC(10, 2),
  reed NUMERIC(10, 2),
  pick NUMERIC(10, 2),
  rpm NUMERIC(10, 2),
  motor TEXT,
  controller TEXT,
  dobby_unit TEXT,
  electronic_components JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_article TEXT,
  current_quality TEXT,
  current_operator_id UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  current_shift_id UUID REFERENCES opa_shifts (id) ON DELETE SET NULL,
  status opa_loom_status NOT NULL DEFAULT 'IDLE',
  location TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_looms_loom_number_unique UNIQUE (loom_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_looms_type ON opa_looms (loom_type);
CREATE INDEX IF NOT EXISTS idx_opa_looms_status ON opa_looms (status);
CREATE INDEX IF NOT EXISTS idx_opa_looms_operator ON opa_looms (current_operator_id);
CREATE INDEX IF NOT EXISTS idx_opa_looms_shift ON opa_looms (current_shift_id);

DROP TRIGGER IF EXISTS trg_opa_looms_updated_at ON opa_looms;
CREATE TRIGGER trg_opa_looms_updated_at
  BEFORE UPDATE ON opa_looms
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Articles (fabric / quality masters)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_code TEXT NOT NULL,
  name TEXT NOT NULL,
  quality TEXT,
  construction TEXT,
  warp_count TEXT,
  weft_count TEXT,
  reed NUMERIC(10, 2),
  pick NUMERIC(10, 2),
  width_cm NUMERIC(10, 2),
  gsm NUMERIC(10, 2),
  loom_type opa_loom_type,
  target_rpm NUMERIC(10, 2),
  target_efficiency NUMERIC(5, 2),
  yarn_composition TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_articles_code_unique UNIQUE (article_code)
);

CREATE INDEX IF NOT EXISTS idx_opa_articles_active ON opa_articles (is_active);

DROP TRIGGER IF EXISTS trg_opa_articles_updated_at ON opa_articles;
CREATE TRIGGER trg_opa_articles_updated_at
  BEFORE UPDATE ON opa_articles
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Production plans
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_production_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_number TEXT NOT NULL,
  plan_date DATE NOT NULL,
  shift_id UUID REFERENCES opa_shifts (id) ON DELETE SET NULL,
  loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL,
  article_id UUID REFERENCES opa_articles (id) ON DELETE SET NULL,
  planned_meter NUMERIC(14, 3) NOT NULL DEFAULT 0,
  planned_kg NUMERIC(14, 3) DEFAULT 0,
  actual_meter NUMERIC(14, 3) DEFAULT 0,
  actual_kg NUMERIC(14, 3) DEFAULT 0,
  status opa_plan_status NOT NULL DEFAULT 'DRAFT',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_production_plans_number_unique UNIQUE (plan_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_production_plans_date ON opa_production_plans (plan_date);
CREATE INDEX IF NOT EXISTS idx_opa_production_plans_loom ON opa_production_plans (loom_id);
CREATE INDEX IF NOT EXISTS idx_opa_production_plans_status ON opa_production_plans (status);

DROP TRIGGER IF EXISTS trg_opa_production_plans_updated_at ON opa_production_plans;
CREATE TRIGGER trg_opa_production_plans_updated_at
  BEFORE UPDATE ON opa_production_plans
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Production entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_production_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number TEXT NOT NULL,
  entry_date DATE NOT NULL,
  shift_id UUID REFERENCES opa_shifts (id) ON DELETE SET NULL,
  loom_id UUID NOT NULL REFERENCES opa_looms (id) ON DELETE RESTRICT,
  article_id UUID REFERENCES opa_articles (id) ON DELETE SET NULL,
  opening_meter NUMERIC(14, 3) NOT NULL DEFAULT 0,
  closing_meter NUMERIC(14, 3) NOT NULL DEFAULT 0,
  production_meter NUMERIC(14, 3) GENERATED ALWAYS AS (closing_meter - opening_meter) STORED,
  production_kg NUMERIC(14, 3) DEFAULT 0,
  running_hours NUMERIC(8, 2) DEFAULT 0,
  downtime_hours NUMERIC(8, 2) DEFAULT 0,
  efficiency NUMERIC(5, 2),
  operator_id UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  supervisor_id UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_production_entries_number_unique UNIQUE (entry_number),
  CONSTRAINT opa_production_entries_meter_check CHECK (closing_meter >= opening_meter)
);

CREATE INDEX IF NOT EXISTS idx_opa_production_entries_date ON opa_production_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_opa_production_entries_loom ON opa_production_entries (loom_id);
CREATE INDEX IF NOT EXISTS idx_opa_production_entries_shift ON opa_production_entries (shift_id);
CREATE INDEX IF NOT EXISTS idx_opa_production_entries_operator ON opa_production_entries (operator_id);

DROP TRIGGER IF EXISTS trg_opa_production_entries_updated_at ON opa_production_entries;
CREATE TRIGGER trg_opa_production_entries_updated_at
  BEFORE UPDATE ON opa_production_entries
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Production targets
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_production_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type opa_target_type NOT NULL,
  target_date DATE NOT NULL,
  shift_id UUID REFERENCES opa_shifts (id) ON DELETE SET NULL,
  loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL,
  article_id UUID REFERENCES opa_articles (id) ON DELETE SET NULL,
  target_meter NUMERIC(14, 3) NOT NULL DEFAULT 0,
  target_kg NUMERIC(14, 3) DEFAULT 0,
  actual_meter NUMERIC(14, 3) DEFAULT 0,
  actual_kg NUMERIC(14, 3) DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_production_targets_date ON opa_production_targets (target_date);
CREATE INDEX IF NOT EXISTS idx_opa_production_targets_type ON opa_production_targets (target_type);
CREATE INDEX IF NOT EXISTS idx_opa_production_targets_loom ON opa_production_targets (loom_id);
CREATE INDEX IF NOT EXISTS idx_opa_production_targets_shift ON opa_production_targets (shift_id);

DROP TRIGGER IF EXISTS trg_opa_production_targets_updated_at ON opa_production_targets;
CREATE TRIGGER trg_opa_production_targets_updated_at
  BEFORE UPDATE ON opa_production_targets
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Loom stoppages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_loom_stoppages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loom_id UUID NOT NULL REFERENCES opa_looms (id) ON DELETE CASCADE,
  shift_id UUID REFERENCES opa_shifts (id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ,
  duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE
      WHEN end_time IS NULL THEN NULL
      ELSE GREATEST(0, ROUND(EXTRACT(EPOCH FROM (end_time - start_time)) / 60)::INTEGER)
    END
  ) STORED,
  reason opa_stoppage_reason NOT NULL DEFAULT 'OTHER',
  department TEXT,
  operator_id UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  technician_id UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_loom_stoppages_time_check CHECK (end_time IS NULL OR end_time >= start_time)
);

CREATE INDEX IF NOT EXISTS idx_opa_loom_stoppages_loom ON opa_loom_stoppages (loom_id);
CREATE INDEX IF NOT EXISTS idx_opa_loom_stoppages_start ON opa_loom_stoppages (start_time DESC);
CREATE INDEX IF NOT EXISTS idx_opa_loom_stoppages_reason ON opa_loom_stoppages (reason);

DROP TRIGGER IF EXISTS trg_opa_loom_stoppages_updated_at ON opa_loom_stoppages;
CREATE TRIGGER trg_opa_loom_stoppages_updated_at
  BEFORE UPDATE ON opa_loom_stoppages
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Quality inspections
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_quality_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_number TEXT NOT NULL,
  inspection_date DATE NOT NULL DEFAULT CURRENT_DATE,
  loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL,
  article_id UUID REFERENCES opa_articles (id) ON DELETE SET NULL,
  production_entry_id UUID REFERENCES opa_production_entries (id) ON DELETE SET NULL,
  shift_id UUID REFERENCES opa_shifts (id) ON DELETE SET NULL,
  inspector_id UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  sample_meters NUMERIC(14, 3),
  result opa_qc_result NOT NULL DEFAULT 'PASS',
  grade TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_quality_inspections_number_unique UNIQUE (inspection_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_quality_inspections_date ON opa_quality_inspections (inspection_date);
CREATE INDEX IF NOT EXISTS idx_opa_quality_inspections_loom ON opa_quality_inspections (loom_id);
CREATE INDEX IF NOT EXISTS idx_opa_quality_inspections_result ON opa_quality_inspections (result);

DROP TRIGGER IF EXISTS trg_opa_quality_inspections_updated_at ON opa_quality_inspections;
CREATE TRIGGER trg_opa_quality_inspections_updated_at
  BEFORE UPDATE ON opa_quality_inspections
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Quality defects
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_quality_defects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inspection_id UUID NOT NULL REFERENCES opa_quality_inspections (id) ON DELETE CASCADE,
  defect_code TEXT,
  defect_name TEXT NOT NULL,
  defect_category TEXT,
  points INTEGER DEFAULT 0,
  meters_affected NUMERIC(14, 3) DEFAULT 0,
  location TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_quality_defects_inspection ON opa_quality_defects (inspection_id);

DROP TRIGGER IF EXISTS trg_opa_quality_defects_updated_at ON opa_quality_defects;
CREATE TRIGGER trg_opa_quality_defects_updated_at
  BEFORE UPDATE ON opa_quality_defects
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

ALTER TABLE opa_looms ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_production_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_production_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_production_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_loom_stoppages ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_quality_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_quality_defects ENABLE ROW LEVEL SECURITY;
