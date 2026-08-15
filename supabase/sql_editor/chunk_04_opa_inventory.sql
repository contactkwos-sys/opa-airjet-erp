-- =============================================================================
-- OPA AIR JET ERP — SQL Editor chunk 4/10
-- Source: supabase/migrations/202608140003_opa_inventory.sql
-- Target project ONLY: rjpwznapyaegotbswlke (OPA AIR JET ERP)
-- Do NOT run on ixulyhomqtajenigopai
-- Paste THIS ENTIRE FILE into Supabase SQL Editor and Run, then continue to next chunk.
-- SQL body below is unchanged from the source migration.
-- =============================================================================

-- =============================================================================
-- OPA Group of India – Air Jet Loom ERP
-- Migration 003: Inventory (stores, items, movements, yarn, beams, greige,
-- spare parts) + negative-stock prevention trigger
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_stock_movement_type') THEN
    CREATE TYPE opa_stock_movement_type AS ENUM (
      'IN',
      'OUT',
      'TRANSFER',
      'ADJUSTMENT',
      'RETURN',
      'ISSUE',
      'RECEIPT'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_yarn_txn_type') THEN
    CREATE TYPE opa_yarn_txn_type AS ENUM (
      'RECEIPT',
      'ISSUE',
      'RETURN',
      'TRANSFER',
      'ADJUSTMENT',
      'CONSUMPTION'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_beam_status') THEN
    CREATE TYPE opa_beam_status AS ENUM (
      'AVAILABLE',
      'ISSUED',
      'RUNNING',
      'COMPLETED',
      'DAMAGED',
      'SCRAPPED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_greige_movement_type') THEN
    CREATE TYPE opa_greige_movement_type AS ENUM (
      'PRODUCTION_IN',
      'DISPATCH_OUT',
      'TRANSFER',
      'ADJUSTMENT',
      'RETURN',
      'QC_HOLD',
      'QC_RELEASE'
    );
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Stores
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  store_type TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_stores_code_unique UNIQUE (code)
);

CREATE INDEX IF NOT EXISTS idx_opa_stores_active ON opa_stores (is_active);

DROP TRIGGER IF EXISTS trg_opa_stores_updated_at ON opa_stores;
CREATE TRIGGER trg_opa_stores_updated_at
  BEFORE UPDATE ON opa_stores
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Inventory items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  uom TEXT NOT NULL DEFAULT 'PCS',
  store_id UUID REFERENCES opa_stores (id) ON DELETE SET NULL,
  reorder_level NUMERIC(14, 3) DEFAULT 0,
  min_stock NUMERIC(14, 3) DEFAULT 0,
  max_stock NUMERIC(14, 3),
  current_qty NUMERIC(14, 3) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(14, 4) DEFAULT 0,
  hsn_code TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_inventory_items_code_unique UNIQUE (item_code)
);

CREATE INDEX IF NOT EXISTS idx_opa_inventory_items_store ON opa_inventory_items (store_id);
CREATE INDEX IF NOT EXISTS idx_opa_inventory_items_category ON opa_inventory_items (category);

DROP TRIGGER IF EXISTS trg_opa_inventory_items_updated_at ON opa_inventory_items;
CREATE TRIGGER trg_opa_inventory_items_updated_at
  BEFORE UPDATE ON opa_inventory_items
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Stock movements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_number TEXT NOT NULL,
  item_id UUID NOT NULL REFERENCES opa_inventory_items (id) ON DELETE RESTRICT,
  store_id UUID REFERENCES opa_stores (id) ON DELETE SET NULL,
  movement_type opa_stock_movement_type NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL,
  balance_after NUMERIC(14, 3),
  reference_module TEXT,
  reference_id UUID,
  allow_negative BOOLEAN NOT NULL DEFAULT FALSE,
  remarks TEXT,
  movement_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_stock_movements_number_unique UNIQUE (movement_number),
  CONSTRAINT opa_stock_movements_qty_nonzero CHECK (quantity <> 0)
);

CREATE INDEX IF NOT EXISTS idx_opa_stock_movements_item ON opa_stock_movements (item_id);
CREATE INDEX IF NOT EXISTS idx_opa_stock_movements_store ON opa_stock_movements (store_id);
CREATE INDEX IF NOT EXISTS idx_opa_stock_movements_at ON opa_stock_movements (movement_at DESC);

DROP TRIGGER IF EXISTS trg_opa_stock_movements_updated_at ON opa_stock_movements;
CREATE TRIGGER trg_opa_stock_movements_updated_at
  BEFORE UPDATE ON opa_stock_movements
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- Prevent negative stock unless allow_negative OR SUPER_ADMIN
CREATE OR REPLACE FUNCTION opa_prevent_negative_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty NUMERIC(14, 3);
  v_new_qty NUMERIC(14, 3);
  v_role opa_role;
  v_delta NUMERIC(14, 3);
BEGIN
  SELECT current_qty INTO v_qty
  FROM opa_inventory_items
  WHERE id = NEW.item_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Inventory item % not found', NEW.item_id;
  END IF;

  v_delta := CASE
    WHEN NEW.movement_type IN ('IN', 'RECEIPT', 'RETURN') THEN NEW.quantity
    WHEN NEW.movement_type IN ('OUT', 'ISSUE') THEN -NEW.quantity
    WHEN NEW.movement_type = 'ADJUSTMENT' THEN NEW.quantity -- signed via app: use IN/OUT for clear direction
    WHEN NEW.movement_type = 'TRANSFER' THEN -NEW.quantity
    ELSE -NEW.quantity
  END;

  -- For ADJUSTMENT, quantity is treated as absolute OUT unless meta says otherwise;
  -- signed adjustments: store signed qty in quantity with type ADJUSTMENT via allow_negative path
  IF NEW.movement_type = 'ADJUSTMENT' AND NEW.quantity < 0 THEN
    v_delta := NEW.quantity;
  END IF;

  v_new_qty := COALESCE(v_qty, 0) + v_delta;

  BEGIN
    SELECT role INTO v_role FROM opa_profiles WHERE id = auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_role := NULL;
  END;

  IF v_new_qty < 0 AND NOT COALESCE(NEW.allow_negative, FALSE) AND COALESCE(v_role, 'LOOM_OPERATOR') <> 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Negative stock not allowed for item % (would be %)', NEW.item_id, v_new_qty
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE opa_inventory_items
  SET current_qty = v_new_qty,
      updated_at = NOW()
  WHERE id = NEW.item_id;

  NEW.balance_after := v_new_qty;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opa_stock_movements_prevent_negative ON opa_stock_movements;
CREATE TRIGGER trg_opa_stock_movements_prevent_negative
  BEFORE INSERT ON opa_stock_movements
  FOR EACH ROW EXECUTE FUNCTION opa_prevent_negative_stock();

-- ---------------------------------------------------------------------------
-- Yarn master & transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_yarn_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  yarn_code TEXT NOT NULL,
  name TEXT NOT NULL,
  count TEXT,
  blend TEXT,
  color TEXT,
  lot_number TEXT,
  supplier_name TEXT,
  uom TEXT NOT NULL DEFAULT 'KG',
  current_qty NUMERIC(14, 3) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(14, 4) DEFAULT 0,
  store_id UUID REFERENCES opa_stores (id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_yarn_master_code_unique UNIQUE (yarn_code)
);

CREATE INDEX IF NOT EXISTS idx_opa_yarn_master_store ON opa_yarn_master (store_id);

DROP TRIGGER IF EXISTS trg_opa_yarn_master_updated_at ON opa_yarn_master;
CREATE TRIGGER trg_opa_yarn_master_updated_at
  BEFORE UPDATE ON opa_yarn_master
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_yarn_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  txn_number TEXT NOT NULL,
  yarn_id UUID NOT NULL REFERENCES opa_yarn_master (id) ON DELETE RESTRICT,
  txn_type opa_yarn_txn_type NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL,
  balance_after NUMERIC(14, 3),
  loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL,
  beam_id UUID,
  reference_module TEXT,
  reference_id UUID,
  remarks TEXT,
  txn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_yarn_transactions_number_unique UNIQUE (txn_number),
  CONSTRAINT opa_yarn_transactions_qty_check CHECK (quantity <> 0)
);

CREATE INDEX IF NOT EXISTS idx_opa_yarn_transactions_yarn ON opa_yarn_transactions (yarn_id);
CREATE INDEX IF NOT EXISTS idx_opa_yarn_transactions_at ON opa_yarn_transactions (txn_at DESC);

DROP TRIGGER IF EXISTS trg_opa_yarn_transactions_updated_at ON opa_yarn_transactions;
CREATE TRIGGER trg_opa_yarn_transactions_updated_at
  BEFORE UPDATE ON opa_yarn_transactions
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE OR REPLACE FUNCTION opa_apply_yarn_txn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qty NUMERIC(14, 3);
  v_new NUMERIC(14, 3);
  v_delta NUMERIC(14, 3);
BEGIN
  SELECT current_qty INTO v_qty FROM opa_yarn_master WHERE id = NEW.yarn_id FOR UPDATE;
  v_delta := CASE
    WHEN NEW.txn_type IN ('RECEIPT', 'RETURN') THEN ABS(NEW.quantity)
    WHEN NEW.txn_type IN ('ISSUE', 'CONSUMPTION') THEN -ABS(NEW.quantity)
    WHEN NEW.txn_type = 'ADJUSTMENT' THEN NEW.quantity
    WHEN NEW.txn_type = 'TRANSFER' THEN -ABS(NEW.quantity)
    ELSE -ABS(NEW.quantity)
  END;
  v_new := COALESCE(v_qty, 0) + v_delta;
  IF v_new < 0 THEN
    RAISE EXCEPTION 'Negative yarn stock not allowed for %', NEW.yarn_id;
  END IF;
  UPDATE opa_yarn_master SET current_qty = v_new, updated_at = NOW() WHERE id = NEW.yarn_id;
  NEW.balance_after := v_new;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opa_yarn_transactions_apply ON opa_yarn_transactions;
CREATE TRIGGER trg_opa_yarn_transactions_apply
  BEFORE INSERT ON opa_yarn_transactions
  FOR EACH ROW EXECUTE FUNCTION opa_apply_yarn_txn();

-- ---------------------------------------------------------------------------
-- Beams
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_beams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  beam_number TEXT NOT NULL,
  yarn_id UUID REFERENCES opa_yarn_master (id) ON DELETE SET NULL,
  article_id UUID REFERENCES opa_articles (id) ON DELETE SET NULL,
  loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL,
  warp_ends INTEGER,
  length_meters NUMERIC(14, 3),
  remaining_meters NUMERIC(14, 3),
  width_cm NUMERIC(10, 2),
  status opa_beam_status NOT NULL DEFAULT 'AVAILABLE',
  issued_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_beams_number_unique UNIQUE (beam_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_beams_status ON opa_beams (status);
CREATE INDEX IF NOT EXISTS idx_opa_beams_loom ON opa_beams (loom_id);

DROP TRIGGER IF EXISTS trg_opa_beams_updated_at ON opa_beams;
CREATE TRIGGER trg_opa_beams_updated_at
  BEFORE UPDATE ON opa_beams
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- FK from yarn transactions to beams (deferred until beams exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'opa_yarn_transactions_beam_id_fkey'
  ) THEN
    ALTER TABLE opa_yarn_transactions
      ADD CONSTRAINT opa_yarn_transactions_beam_id_fkey
      FOREIGN KEY (beam_id) REFERENCES opa_beams (id) ON DELETE SET NULL;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Greige stock & movements
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_greige_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_number TEXT NOT NULL,
  article_id UUID REFERENCES opa_articles (id) ON DELETE SET NULL,
  loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL,
  quality_grade TEXT,
  meters NUMERIC(14, 3) NOT NULL DEFAULT 0,
  kg NUMERIC(14, 3) DEFAULT 0,
  store_id UUID REFERENCES opa_stores (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'AVAILABLE',
  production_entry_id UUID REFERENCES opa_production_entries (id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_greige_stock_lot_unique UNIQUE (lot_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_greige_stock_article ON opa_greige_stock (article_id);
CREATE INDEX IF NOT EXISTS idx_opa_greige_stock_status ON opa_greige_stock (status);

DROP TRIGGER IF EXISTS trg_opa_greige_stock_updated_at ON opa_greige_stock;
CREATE TRIGGER trg_opa_greige_stock_updated_at
  BEFORE UPDATE ON opa_greige_stock
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_greige_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_number TEXT NOT NULL,
  greige_id UUID NOT NULL REFERENCES opa_greige_stock (id) ON DELETE RESTRICT,
  movement_type opa_greige_movement_type NOT NULL,
  meters NUMERIC(14, 3) NOT NULL,
  kg NUMERIC(14, 3) DEFAULT 0,
  reference_module TEXT,
  reference_id UUID,
  remarks TEXT,
  movement_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_greige_movements_number_unique UNIQUE (movement_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_greige_movements_greige ON opa_greige_movements (greige_id);

DROP TRIGGER IF EXISTS trg_opa_greige_movements_updated_at ON opa_greige_movements;
CREATE TRIGGER trg_opa_greige_movements_updated_at
  BEFORE UPDATE ON opa_greige_movements
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Spare parts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_spare_parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  part_code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  compatible_loom_types TEXT[],
  uom TEXT NOT NULL DEFAULT 'PCS',
  store_id UUID REFERENCES opa_stores (id) ON DELETE SET NULL,
  inventory_item_id UUID REFERENCES opa_inventory_items (id) ON DELETE SET NULL,
  reorder_level NUMERIC(14, 3) DEFAULT 0,
  current_qty NUMERIC(14, 3) NOT NULL DEFAULT 0,
  unit_cost NUMERIC(14, 4) DEFAULT 0,
  manufacturer TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_spare_parts_code_unique UNIQUE (part_code)
);

CREATE INDEX IF NOT EXISTS idx_opa_spare_parts_store ON opa_spare_parts (store_id);
CREATE INDEX IF NOT EXISTS idx_opa_spare_parts_category ON opa_spare_parts (category);

DROP TRIGGER IF EXISTS trg_opa_spare_parts_updated_at ON opa_spare_parts;
CREATE TRIGGER trg_opa_spare_parts_updated_at
  BEFORE UPDATE ON opa_spare_parts
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

ALTER TABLE opa_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_yarn_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_yarn_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_beams ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_greige_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_greige_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_spare_parts ENABLE ROW LEVEL SECURITY;
