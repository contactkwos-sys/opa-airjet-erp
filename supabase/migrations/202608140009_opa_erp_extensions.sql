-- =============================================================================
-- OPA Air Jet ERP — Migration 009: Additive production extensions
-- Target: NEW project opa-airjet-erp ONLY (never ixulyhomqtajenigopai)
-- Non-destructive: ADD COLUMN / CREATE IF NOT EXISTS / UPDATE codes only
-- No DROP TABLE / TRUNCATE / DELETE
-- =============================================================================

-- Optional role aliases used by UI RBAC (safe if already present)
DO $$
BEGIN
  ALTER TYPE opa_role ADD VALUE IF NOT EXISTS 'ADMIN';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TYPE opa_role ADD VALUE IF NOT EXISTS 'VIEWER';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TYPE opa_role ADD VALUE IF NOT EXISTS 'PRODUCTION_HEAD';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER TYPE opa_role ADD VALUE IF NOT EXISTS 'MAINTENANCE_ENGINEER';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- Loom Master extensions (keep opa_looms — compatibility view below)
-- ---------------------------------------------------------------------------
ALTER TABLE opa_looms ADD COLUMN IF NOT EXISTS loom_code TEXT;
ALTER TABLE opa_looms ADD COLUMN IF NOT EXISTS production_capacity NUMERIC(14, 3);
ALTER TABLE opa_looms ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE opa_looms ADD COLUMN IF NOT EXISTS operator_name TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_opa_looms_loom_code_unique
  ON opa_looms (loom_code)
  WHERE loom_code IS NOT NULL;

-- Backfill D01–D36 / P01–P36 codes from existing rows (idempotent)
WITH ranked AS (
  SELECT
    id,
    loom_type,
    ROW_NUMBER() OVER (PARTITION BY loom_type ORDER BY loom_number, created_at) AS rn
  FROM opa_looms
)
UPDATE opa_looms l
SET loom_code = CASE
  WHEN r.loom_type = 'DOBBY' THEN 'D' || LPAD(r.rn::TEXT, 2, '0')
  ELSE 'P' || LPAD(r.rn::TEXT, 2, '0')
END
FROM ranked r
WHERE l.id = r.id
  AND (l.loom_code IS NULL OR btrim(l.loom_code) = '');

-- Prefer short loom codes as loom_number when still using long seed names
UPDATE opa_looms
SET loom_number = loom_code
WHERE loom_code IS NOT NULL
  AND (
    loom_number LIKE 'DOBBY LOOM %'
    OR loom_number LIKE 'PLAIN LOOM %'
  );

-- Ensure 72 coded looms exist (no overwrite of other rows)
INSERT INTO opa_looms (loom_number, loom_code, loom_type, status, is_active, location, department, make, model, production_capacity)
SELECT
  CASE WHEN g <= 36 THEN 'D' || LPAD(g::TEXT, 2, '0') ELSE 'P' || LPAD((g - 36)::TEXT, 2, '0') END,
  CASE WHEN g <= 36 THEN 'D' || LPAD(g::TEXT, 2, '0') ELSE 'P' || LPAD((g - 36)::TEXT, 2, '0') END,
  CASE WHEN g <= 36 THEN 'DOBBY'::opa_loom_type ELSE 'PLAIN'::opa_loom_type END,
  'IDLE'::opa_loom_status,
  TRUE,
  CASE WHEN g <= 36 THEN 'Shed A' ELSE 'Shed B' END,
  'Production',
  'Toyota',
  CASE WHEN g <= 36 THEN 'JAT810-D' ELSE 'JAT810' END,
  1200
FROM generate_series(1, 72) AS g
ON CONFLICT (loom_number) DO NOTHING;

-- Compatibility view requested as opa_loom_master (non-destructive)
CREATE OR REPLACE VIEW opa_loom_master AS
SELECT
  id AS loom_id,
  loom_number,
  loom_code,
  loom_type,
  make,
  model,
  serial_number,
  installation_date,
  width,
  rpm,
  production_capacity,
  location,
  department,
  operator_name,
  current_operator_id,
  current_shift_id,
  status,
  is_active AS active,
  created_at,
  updated_at
FROM opa_looms;

-- ---------------------------------------------------------------------------
-- Production entry extensions
-- ---------------------------------------------------------------------------
ALTER TABLE opa_production_entries ADD COLUMN IF NOT EXISTS shift_code TEXT;
ALTER TABLE opa_production_entries ADD COLUMN IF NOT EXISTS operator_name TEXT;
ALTER TABLE opa_production_entries ADD COLUMN IF NOT EXISTS style TEXT;
ALTER TABLE opa_production_entries ADD COLUMN IF NOT EXISTS design TEXT;
ALTER TABLE opa_production_entries ADD COLUMN IF NOT EXISTS fabric_quality TEXT;
ALTER TABLE opa_production_entries ADD COLUMN IF NOT EXISTS fabric_width NUMERIC(10, 2);
ALTER TABLE opa_production_entries ADD COLUMN IF NOT EXISTS gsm NUMERIC(10, 2);
ALTER TABLE opa_production_entries ADD COLUMN IF NOT EXISTS warp_count TEXT;
ALTER TABLE opa_production_entries ADD COLUMN IF NOT EXISTS weft_count TEXT;
ALTER TABLE opa_production_entries ADD COLUMN IF NOT EXISTS beam_no TEXT;
ALTER TABLE opa_production_entries ADD COLUMN IF NOT EXISTS waste_kg NUMERIC(14, 3) DEFAULT 0;
ALTER TABLE opa_production_entries ADD COLUMN IF NOT EXISTS waste_percentage NUMERIC(8, 2);

CREATE INDEX IF NOT EXISTS idx_opa_production_entries_shift_code
  ON opa_production_entries (shift_code);

-- Target achievement helper columns already exist (actual_meter/kg)

-- ---------------------------------------------------------------------------
-- Company / inventory policy
-- ---------------------------------------------------------------------------
ALTER TABLE opa_company_settings
  ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- Stock negative-guard trigger (respects allow_negative_stock)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION opa_prevent_negative_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  allow_neg BOOLEAN := FALSE;
BEGIN
  SELECT COALESCE(allow_negative_stock, FALSE)
    INTO allow_neg
    FROM opa_company_settings
   LIMIT 1;

  IF allow_neg THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'opa_inventory_items' AND NEW.current_qty < 0 THEN
    RAISE EXCEPTION 'Negative stock not allowed for inventory item %', NEW.item_code;
  END IF;

  IF TG_TABLE_NAME = 'opa_yarn_master' AND NEW.current_qty < 0 THEN
    RAISE EXCEPTION 'Negative yarn stock not allowed for %', NEW.yarn_code;
  END IF;

  IF TG_TABLE_NAME = 'opa_spare_parts' AND NEW.current_qty < 0 THEN
    RAISE EXCEPTION 'Negative spare stock not allowed for %', NEW.part_code;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opa_inventory_items_no_neg ON opa_inventory_items;
CREATE TRIGGER trg_opa_inventory_items_no_neg
  BEFORE INSERT OR UPDATE OF current_qty ON opa_inventory_items
  FOR EACH ROW EXECUTE FUNCTION opa_prevent_negative_stock();

DROP TRIGGER IF EXISTS trg_opa_yarn_master_no_neg ON opa_yarn_master;
CREATE TRIGGER trg_opa_yarn_master_no_neg
  BEFORE INSERT OR UPDATE OF current_qty ON opa_yarn_master
  FOR EACH ROW EXECUTE FUNCTION opa_prevent_negative_stock();

DROP TRIGGER IF EXISTS trg_opa_spare_parts_no_neg ON opa_spare_parts;
CREATE TRIGGER trg_opa_spare_parts_no_neg
  BEFORE INSERT OR UPDATE OF current_qty ON opa_spare_parts
  FOR EACH ROW EXECUTE FUNCTION opa_prevent_negative_stock();

-- ---------------------------------------------------------------------------
-- Extra indexes requested
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_opa_inventory_items_status ON opa_inventory_items (is_active);
CREATE INDEX IF NOT EXISTS idx_opa_suppliers_status ON opa_suppliers (is_active);
CREATE INDEX IF NOT EXISTS idx_opa_purchase_orders_status ON opa_purchase_orders (status);
CREATE INDEX IF NOT EXISTS idx_opa_grns_status ON opa_grns (status);
CREATE INDEX IF NOT EXISTS idx_opa_maintenance_requests_status ON opa_maintenance_requests (status);
