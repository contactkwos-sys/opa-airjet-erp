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
CREATE TABLE IF NOT EXISTS opa_stores ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), code TEXT NOT NULL, name TEXT NOT NULL, location TEXT, store_type TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_stores_code_unique UNIQUE (code) );
CREATE INDEX IF NOT EXISTS idx_opa_stores_active ON opa_stores (is_active);
DROP TRIGGER IF EXISTS trg_opa_stores_updated_at ON opa_stores;
CREATE TRIGGER trg_opa_stores_updated_at BEFORE UPDATE ON opa_stores FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_inventory_items ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), item_code TEXT NOT NULL, name TEXT NOT NULL, category TEXT, uom TEXT NOT NULL DEFAULT 'PCS', store_id UUID REFERENCES opa_stores (id) ON DELETE SET NULL, reorder_level NUMERIC(14, 3) DEFAULT 0, min_stock NUMERIC(14, 3) DEFAULT 0, max_stock NUMERIC(14, 3), current_qty NUMERIC(14, 3) NOT NULL DEFAULT 0, unit_cost NUMERIC(14, 4) DEFAULT 0, hsn_code TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE, meta JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_inventory_items_code_unique UNIQUE (item_code) );
CREATE INDEX IF NOT EXISTS idx_opa_inventory_items_store ON opa_inventory_items (store_id);
CREATE INDEX IF NOT EXISTS idx_opa_inventory_items_category ON opa_inventory_items (category);
DROP TRIGGER IF EXISTS trg_opa_inventory_items_updated_at ON opa_inventory_items;
CREATE TRIGGER trg_opa_inventory_items_updated_at BEFORE UPDATE ON opa_inventory_items FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_stock_movements ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), movement_number TEXT NOT NULL, item_id UUID NOT NULL REFERENCES opa_inventory_items (id) ON DELETE RESTRICT, store_id UUID REFERENCES opa_stores (id) ON DELETE SET NULL, movement_type opa_stock_movement_type NOT NULL, quantity NUMERIC(14, 3) NOT NULL, balance_after NUMERIC(14, 3), reference_module TEXT, reference_id UUID, allow_negative BOOLEAN NOT NULL DEFAULT FALSE, remarks TEXT, movement_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_stock_movements_number_unique UNIQUE (movement_number), CONSTRAINT opa_stock_movements_qty_nonzero CHECK (quantity <> 0) );
CREATE INDEX IF NOT EXISTS idx_opa_stock_movements_item ON opa_stock_movements (item_id);
CREATE INDEX IF NOT EXISTS idx_opa_stock_movements_store ON opa_stock_movements (store_id);
CREATE INDEX IF NOT EXISTS idx_opa_stock_movements_at ON opa_stock_movements (movement_at DESC);
DROP TRIGGER IF EXISTS trg_opa_stock_movements_updated_at ON opa_stock_movements;
CREATE TRIGGER trg_opa_stock_movements_updated_at BEFORE UPDATE ON opa_stock_movements FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE OR REPLACE FUNCTION opa_prevent_negative_stock() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
CREATE TRIGGER trg_opa_stock_movements_prevent_negative BEFORE INSERT ON opa_stock_movements FOR EACH ROW EXECUTE FUNCTION opa_prevent_negative_stock();
CREATE TABLE IF NOT EXISTS opa_yarn_master ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), yarn_code TEXT NOT NULL, name TEXT NOT NULL, count TEXT, blend TEXT, color TEXT, lot_number TEXT, supplier_name TEXT, uom TEXT NOT NULL DEFAULT 'KG', current_qty NUMERIC(14, 3) NOT NULL DEFAULT 0, unit_cost NUMERIC(14, 4) DEFAULT 0, store_id UUID REFERENCES opa_stores (id) ON DELETE SET NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_yarn_master_code_unique UNIQUE (yarn_code) );
CREATE INDEX IF NOT EXISTS idx_opa_yarn_master_store ON opa_yarn_master (store_id);
DROP TRIGGER IF EXISTS trg_opa_yarn_master_updated_at ON opa_yarn_master;
CREATE TRIGGER trg_opa_yarn_master_updated_at BEFORE UPDATE ON opa_yarn_master FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_yarn_transactions ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), txn_number TEXT NOT NULL, yarn_id UUID NOT NULL REFERENCES opa_yarn_master (id) ON DELETE RESTRICT, txn_type opa_yarn_txn_type NOT NULL, quantity NUMERIC(14, 3) NOT NULL, balance_after NUMERIC(14, 3), loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL, beam_id UUID, reference_module TEXT, reference_id UUID, remarks TEXT, txn_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_yarn_transactions_number_unique UNIQUE (txn_number), CONSTRAINT opa_yarn_transactions_qty_check CHECK (quantity <> 0) );
CREATE INDEX IF NOT EXISTS idx_opa_yarn_transactions_yarn ON opa_yarn_transactions (yarn_id);
CREATE INDEX IF NOT EXISTS idx_opa_yarn_transactions_at ON opa_yarn_transactions (txn_at DESC);
DROP TRIGGER IF EXISTS trg_opa_yarn_transactions_updated_at ON opa_yarn_transactions;
CREATE TRIGGER trg_opa_yarn_transactions_updated_at BEFORE UPDATE ON opa_yarn_transactions FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE OR REPLACE FUNCTION opa_apply_yarn_txn() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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
CREATE TRIGGER trg_opa_yarn_transactions_apply BEFORE INSERT ON opa_yarn_transactions FOR EACH ROW EXECUTE FUNCTION opa_apply_yarn_txn();
CREATE TABLE IF NOT EXISTS opa_beams ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), beam_number TEXT NOT NULL, yarn_id UUID REFERENCES opa_yarn_master (id) ON DELETE SET NULL, article_id UUID REFERENCES opa_articles (id) ON DELETE SET NULL, loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL, warp_ends INTEGER, length_meters NUMERIC(14, 3), remaining_meters NUMERIC(14, 3), width_cm NUMERIC(10, 2), status opa_beam_status NOT NULL DEFAULT 'AVAILABLE', issued_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_beams_number_unique UNIQUE (beam_number) );
CREATE INDEX IF NOT EXISTS idx_opa_beams_status ON opa_beams (status);
CREATE INDEX IF NOT EXISTS idx_opa_beams_loom ON opa_beams (loom_id);
DROP TRIGGER IF EXISTS trg_opa_beams_updated_at ON opa_beams;
CREATE TRIGGER trg_opa_beams_updated_at BEFORE UPDATE ON opa_beams FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
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
CREATE TABLE IF NOT EXISTS opa_greige_stock ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), lot_number TEXT NOT NULL, article_id UUID REFERENCES opa_articles (id) ON DELETE SET NULL, loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL, quality_grade TEXT, meters NUMERIC(14, 3) NOT NULL DEFAULT 0, kg NUMERIC(14, 3) DEFAULT 0, store_id UUID REFERENCES opa_stores (id) ON DELETE SET NULL, status TEXT NOT NULL DEFAULT 'AVAILABLE', production_entry_id UUID REFERENCES opa_production_entries (id) ON DELETE SET NULL, remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_greige_stock_lot_unique UNIQUE (lot_number) );
CREATE INDEX IF NOT EXISTS idx_opa_greige_stock_article ON opa_greige_stock (article_id);
CREATE INDEX IF NOT EXISTS idx_opa_greige_stock_status ON opa_greige_stock (status);
DROP TRIGGER IF EXISTS trg_opa_greige_stock_updated_at ON opa_greige_stock;
CREATE TRIGGER trg_opa_greige_stock_updated_at BEFORE UPDATE ON opa_greige_stock FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_greige_movements ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), movement_number TEXT NOT NULL, greige_id UUID NOT NULL REFERENCES opa_greige_stock (id) ON DELETE RESTRICT, movement_type opa_greige_movement_type NOT NULL, meters NUMERIC(14, 3) NOT NULL, kg NUMERIC(14, 3) DEFAULT 0, reference_module TEXT, reference_id UUID, remarks TEXT, movement_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_greige_movements_number_unique UNIQUE (movement_number) );
CREATE INDEX IF NOT EXISTS idx_opa_greige_movements_greige ON opa_greige_movements (greige_id);
DROP TRIGGER IF EXISTS trg_opa_greige_movements_updated_at ON opa_greige_movements;
CREATE TRIGGER trg_opa_greige_movements_updated_at BEFORE UPDATE ON opa_greige_movements FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_spare_parts ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), part_code TEXT NOT NULL, name TEXT NOT NULL, category TEXT, compatible_loom_types TEXT[], uom TEXT NOT NULL DEFAULT 'PCS', store_id UUID REFERENCES opa_stores (id) ON DELETE SET NULL, inventory_item_id UUID REFERENCES opa_inventory_items (id) ON DELETE SET NULL, reorder_level NUMERIC(14, 3) DEFAULT 0, current_qty NUMERIC(14, 3) NOT NULL DEFAULT 0, unit_cost NUMERIC(14, 4) DEFAULT 0, manufacturer TEXT, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_spare_parts_code_unique UNIQUE (part_code) );
CREATE INDEX IF NOT EXISTS idx_opa_spare_parts_store ON opa_spare_parts (store_id);
CREATE INDEX IF NOT EXISTS idx_opa_spare_parts_category ON opa_spare_parts (category);
DROP TRIGGER IF EXISTS trg_opa_spare_parts_updated_at ON opa_spare_parts;
CREATE TRIGGER trg_opa_spare_parts_updated_at BEFORE UPDATE ON opa_spare_parts FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
ALTER TABLE opa_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_yarn_master ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_yarn_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_beams ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_greige_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_greige_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_spare_parts ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_doc_status') THEN
    CREATE TYPE opa_doc_status AS ENUM (
      'DRAFT',
      'SUBMITTED',
      'APPROVED',
      'REJECTED',
      'PARTIAL',
      'COMPLETED',
      'CANCELLED',
      'CLOSED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_payment_status') THEN
    CREATE TYPE opa_payment_status AS ENUM (
      'PENDING',
      'PARTIAL',
      'PAID',
      'OVERDUE',
      'CANCELLED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_payment_mode') THEN
    CREATE TYPE opa_payment_mode AS ENUM (
      'CASH',
      'CHEQUE',
      'NEFT',
      'RTGS',
      'UPI',
      'CARD',
      'OTHER'
    );
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS opa_suppliers ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), supplier_code TEXT NOT NULL, name TEXT NOT NULL, contact_person TEXT, email TEXT, mobile TEXT, phone TEXT, address TEXT, city TEXT, state TEXT, pincode TEXT, gstin TEXT, pan TEXT, payment_terms TEXT, credit_limit NUMERIC(14, 2) DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE, meta JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_suppliers_code_unique UNIQUE (supplier_code) );
CREATE INDEX IF NOT EXISTS idx_opa_suppliers_active ON opa_suppliers (is_active);
CREATE INDEX IF NOT EXISTS idx_opa_suppliers_name ON opa_suppliers (name);
DROP TRIGGER IF EXISTS trg_opa_suppliers_updated_at ON opa_suppliers;
CREATE TRIGGER trg_opa_suppliers_updated_at BEFORE UPDATE ON opa_suppliers FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_supplier_transactions ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), supplier_id UUID NOT NULL REFERENCES opa_suppliers (id) ON DELETE CASCADE, txn_date DATE NOT NULL DEFAULT CURRENT_DATE, txn_type TEXT NOT NULL, reference_module TEXT, reference_id UUID, debit NUMERIC(14, 2) NOT NULL DEFAULT 0, credit NUMERIC(14, 2) NOT NULL DEFAULT 0, balance NUMERIC(14, 2), remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID );
CREATE INDEX IF NOT EXISTS idx_opa_supplier_transactions_supplier ON opa_supplier_transactions (supplier_id, txn_date);
DROP TRIGGER IF EXISTS trg_opa_supplier_transactions_updated_at ON opa_supplier_transactions;
CREATE TRIGGER trg_opa_supplier_transactions_updated_at BEFORE UPDATE ON opa_supplier_transactions FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE OR REPLACE VIEW opa_supplier_ledger AS SELECT st.id, st.supplier_id, s.supplier_code, s.name AS supplier_name, st.txn_date, st.txn_type, st.reference_module, st.reference_id, st.debit, st.credit, SUM(st.debit - st.credit) OVER ( PARTITION BY st.supplier_id ORDER BY st.txn_date, st.created_at, st.id ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW ) AS running_balance, st.remarks, st.created_at FROM opa_supplier_transactions st JOIN opa_suppliers s ON s.id = st.supplier_id;
CREATE TABLE IF NOT EXISTS opa_purchase_requisitions ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), pr_number TEXT NOT NULL, request_date DATE NOT NULL DEFAULT CURRENT_DATE, department_id UUID REFERENCES opa_departments (id) ON DELETE SET NULL, requested_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL, required_by DATE, status opa_doc_status NOT NULL DEFAULT 'DRAFT', priority TEXT DEFAULT 'NORMAL', remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_purchase_requisitions_number_unique UNIQUE (pr_number) );
CREATE INDEX IF NOT EXISTS idx_opa_prs_status ON opa_purchase_requisitions (status);
CREATE INDEX IF NOT EXISTS idx_opa_prs_date ON opa_purchase_requisitions (request_date);
DROP TRIGGER IF EXISTS trg_opa_purchase_requisitions_updated_at ON opa_purchase_requisitions;
CREATE TRIGGER trg_opa_purchase_requisitions_updated_at BEFORE UPDATE ON opa_purchase_requisitions FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_purchase_requisition_items ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), pr_id UUID NOT NULL REFERENCES opa_purchase_requisitions (id) ON DELETE CASCADE, item_id UUID REFERENCES opa_inventory_items (id) ON DELETE SET NULL, description TEXT NOT NULL, quantity NUMERIC(14, 3) NOT NULL, uom TEXT NOT NULL DEFAULT 'PCS', estimated_rate NUMERIC(14, 4) DEFAULT 0, remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID );
CREATE INDEX IF NOT EXISTS idx_opa_pr_items_pr ON opa_purchase_requisition_items (pr_id);
DROP TRIGGER IF EXISTS trg_opa_purchase_requisition_items_updated_at ON opa_purchase_requisition_items;
CREATE TRIGGER trg_opa_purchase_requisition_items_updated_at BEFORE UPDATE ON opa_purchase_requisition_items FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_rfqs ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), rfq_number TEXT NOT NULL, pr_id UUID REFERENCES opa_purchase_requisitions (id) ON DELETE SET NULL, rfq_date DATE NOT NULL DEFAULT CURRENT_DATE, due_date DATE, status opa_doc_status NOT NULL DEFAULT 'DRAFT', remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_rfqs_number_unique UNIQUE (rfq_number) );
CREATE INDEX IF NOT EXISTS idx_opa_rfqs_status ON opa_rfqs (status);
DROP TRIGGER IF EXISTS trg_opa_rfqs_updated_at ON opa_rfqs;
CREATE TRIGGER trg_opa_rfqs_updated_at BEFORE UPDATE ON opa_rfqs FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_supplier_quotations ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), quotation_number TEXT NOT NULL, rfq_id UUID REFERENCES opa_rfqs (id) ON DELETE SET NULL, supplier_id UUID NOT NULL REFERENCES opa_suppliers (id) ON DELETE RESTRICT, quotation_date DATE NOT NULL DEFAULT CURRENT_DATE, valid_until DATE, currency TEXT NOT NULL DEFAULT 'INR', total_amount NUMERIC(14, 2) DEFAULT 0, status opa_doc_status NOT NULL DEFAULT 'DRAFT', is_selected BOOLEAN NOT NULL DEFAULT FALSE, remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_supplier_quotations_number_unique UNIQUE (quotation_number) );
CREATE INDEX IF NOT EXISTS idx_opa_supplier_quotations_rfq ON opa_supplier_quotations (rfq_id);
CREATE INDEX IF NOT EXISTS idx_opa_supplier_quotations_supplier ON opa_supplier_quotations (supplier_id);
DROP TRIGGER IF EXISTS trg_opa_supplier_quotations_updated_at ON opa_supplier_quotations;
CREATE TRIGGER trg_opa_supplier_quotations_updated_at BEFORE UPDATE ON opa_supplier_quotations FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_quotation_items ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), quotation_id UUID NOT NULL REFERENCES opa_supplier_quotations (id) ON DELETE CASCADE, item_id UUID REFERENCES opa_inventory_items (id) ON DELETE SET NULL, description TEXT NOT NULL, quantity NUMERIC(14, 3) NOT NULL, uom TEXT NOT NULL DEFAULT 'PCS', rate NUMERIC(14, 4) NOT NULL DEFAULT 0, amount NUMERIC(14, 2) GENERATED ALWAYS AS (ROUND(quantity * rate, 2)) STORED, lead_time_days INTEGER, remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID );
CREATE INDEX IF NOT EXISTS idx_opa_quotation_items_quotation ON opa_quotation_items (quotation_id);
DROP TRIGGER IF EXISTS trg_opa_quotation_items_updated_at ON opa_quotation_items;
CREATE TRIGGER trg_opa_quotation_items_updated_at BEFORE UPDATE ON opa_quotation_items FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_purchase_orders ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), po_number TEXT NOT NULL, supplier_id UUID NOT NULL REFERENCES opa_suppliers (id) ON DELETE RESTRICT, quotation_id UUID REFERENCES opa_supplier_quotations (id) ON DELETE SET NULL, pr_id UUID REFERENCES opa_purchase_requisitions (id) ON DELETE SET NULL, po_date DATE NOT NULL DEFAULT CURRENT_DATE, expected_delivery DATE, currency TEXT NOT NULL DEFAULT 'INR', subtotal NUMERIC(14, 2) DEFAULT 0, tax_amount NUMERIC(14, 2) DEFAULT 0, total_amount NUMERIC(14, 2) DEFAULT 0, status opa_doc_status NOT NULL DEFAULT 'DRAFT', payment_status opa_payment_status NOT NULL DEFAULT 'PENDING', remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_purchase_orders_number_unique UNIQUE (po_number) );
CREATE INDEX IF NOT EXISTS idx_opa_pos_supplier ON opa_purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_opa_pos_status ON opa_purchase_orders (status);
CREATE INDEX IF NOT EXISTS idx_opa_pos_date ON opa_purchase_orders (po_date);
DROP TRIGGER IF EXISTS trg_opa_purchase_orders_updated_at ON opa_purchase_orders;
CREATE TRIGGER trg_opa_purchase_orders_updated_at BEFORE UPDATE ON opa_purchase_orders FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_purchase_order_items ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), po_id UUID NOT NULL REFERENCES opa_purchase_orders (id) ON DELETE CASCADE, item_id UUID REFERENCES opa_inventory_items (id) ON DELETE SET NULL, description TEXT NOT NULL, quantity NUMERIC(14, 3) NOT NULL, received_qty NUMERIC(14, 3) NOT NULL DEFAULT 0, uom TEXT NOT NULL DEFAULT 'PCS', rate NUMERIC(14, 4) NOT NULL DEFAULT 0, tax_pct NUMERIC(5, 2) DEFAULT 0, amount NUMERIC(14, 2) GENERATED ALWAYS AS (ROUND(quantity * rate, 2)) STORED, remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID );
CREATE INDEX IF NOT EXISTS idx_opa_po_items_po ON opa_purchase_order_items (po_id);
DROP TRIGGER IF EXISTS trg_opa_purchase_order_items_updated_at ON opa_purchase_order_items;
CREATE TRIGGER trg_opa_purchase_order_items_updated_at BEFORE UPDATE ON opa_purchase_order_items FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_grns ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), grn_number TEXT NOT NULL, po_id UUID REFERENCES opa_purchase_orders (id) ON DELETE SET NULL, supplier_id UUID REFERENCES opa_suppliers (id) ON DELETE SET NULL, store_id UUID REFERENCES opa_stores (id) ON DELETE SET NULL, grn_date DATE NOT NULL DEFAULT CURRENT_DATE, invoice_number TEXT, invoice_date DATE, status opa_doc_status NOT NULL DEFAULT 'DRAFT', remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_grns_number_unique UNIQUE (grn_number) );
CREATE INDEX IF NOT EXISTS idx_opa_grns_po ON opa_grns (po_id);
CREATE INDEX IF NOT EXISTS idx_opa_grns_date ON opa_grns (grn_date);
DROP TRIGGER IF EXISTS trg_opa_grns_updated_at ON opa_grns;
CREATE TRIGGER trg_opa_grns_updated_at BEFORE UPDATE ON opa_grns FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_grn_items ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), grn_id UUID NOT NULL REFERENCES opa_grns (id) ON DELETE CASCADE, po_item_id UUID REFERENCES opa_purchase_order_items (id) ON DELETE SET NULL, item_id UUID REFERENCES opa_inventory_items (id) ON DELETE SET NULL, description TEXT NOT NULL, ordered_qty NUMERIC(14, 3) DEFAULT 0, received_qty NUMERIC(14, 3) NOT NULL, accepted_qty NUMERIC(14, 3), rejected_qty NUMERIC(14, 3) DEFAULT 0, uom TEXT NOT NULL DEFAULT 'PCS', remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID );
CREATE INDEX IF NOT EXISTS idx_opa_grn_items_grn ON opa_grn_items (grn_id);
DROP TRIGGER IF EXISTS trg_opa_grn_items_updated_at ON opa_grn_items;
CREATE TRIGGER trg_opa_grn_items_updated_at BEFORE UPDATE ON opa_grn_items FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_customers ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), customer_code TEXT NOT NULL, name TEXT NOT NULL, contact_person TEXT, email TEXT, mobile TEXT, phone TEXT, address TEXT, city TEXT, state TEXT, pincode TEXT, gstin TEXT, pan TEXT, payment_terms TEXT, credit_limit NUMERIC(14, 2) DEFAULT 0, is_active BOOLEAN NOT NULL DEFAULT TRUE, meta JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_customers_code_unique UNIQUE (customer_code) );
CREATE INDEX IF NOT EXISTS idx_opa_customers_active ON opa_customers (is_active);
CREATE INDEX IF NOT EXISTS idx_opa_customers_name ON opa_customers (name);
DROP TRIGGER IF EXISTS trg_opa_customers_updated_at ON opa_customers;
CREATE TRIGGER trg_opa_customers_updated_at BEFORE UPDATE ON opa_customers FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_sales_orders ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), so_number TEXT NOT NULL, customer_id UUID NOT NULL REFERENCES opa_customers (id) ON DELETE RESTRICT, so_date DATE NOT NULL DEFAULT CURRENT_DATE, delivery_date DATE, currency TEXT NOT NULL DEFAULT 'INR', subtotal NUMERIC(14, 2) DEFAULT 0, tax_amount NUMERIC(14, 2) DEFAULT 0, total_amount NUMERIC(14, 2) DEFAULT 0, status opa_doc_status NOT NULL DEFAULT 'DRAFT', payment_status opa_payment_status NOT NULL DEFAULT 'PENDING', remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_sales_orders_number_unique UNIQUE (so_number) );
CREATE INDEX IF NOT EXISTS idx_opa_sos_customer ON opa_sales_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_opa_sos_status ON opa_sales_orders (status);
CREATE INDEX IF NOT EXISTS idx_opa_sos_date ON opa_sales_orders (so_date);
DROP TRIGGER IF EXISTS trg_opa_sales_orders_updated_at ON opa_sales_orders;
CREATE TRIGGER trg_opa_sales_orders_updated_at BEFORE UPDATE ON opa_sales_orders FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_sales_order_items ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), so_id UUID NOT NULL REFERENCES opa_sales_orders (id) ON DELETE CASCADE, article_id UUID REFERENCES opa_articles (id) ON DELETE SET NULL, description TEXT NOT NULL, quantity NUMERIC(14, 3) NOT NULL, dispatched_qty NUMERIC(14, 3) NOT NULL DEFAULT 0, uom TEXT NOT NULL DEFAULT 'MTR', rate NUMERIC(14, 4) NOT NULL DEFAULT 0, amount NUMERIC(14, 2) GENERATED ALWAYS AS (ROUND(quantity * rate, 2)) STORED, remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID );
CREATE INDEX IF NOT EXISTS idx_opa_so_items_so ON opa_sales_order_items (so_id);
DROP TRIGGER IF EXISTS trg_opa_sales_order_items_updated_at ON opa_sales_order_items;
CREATE TRIGGER trg_opa_sales_order_items_updated_at BEFORE UPDATE ON opa_sales_order_items FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_dispatches ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), dispatch_number TEXT NOT NULL, so_id UUID REFERENCES opa_sales_orders (id) ON DELETE SET NULL, customer_id UUID REFERENCES opa_customers (id) ON DELETE SET NULL, dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE, vehicle_number TEXT, transporter TEXT, lr_number TEXT, status opa_doc_status NOT NULL DEFAULT 'DRAFT', remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_dispatches_number_unique UNIQUE (dispatch_number) );
CREATE INDEX IF NOT EXISTS idx_opa_dispatches_so ON opa_dispatches (so_id);
CREATE INDEX IF NOT EXISTS idx_opa_dispatches_date ON opa_dispatches (dispatch_date);
DROP TRIGGER IF EXISTS trg_opa_dispatches_updated_at ON opa_dispatches;
CREATE TRIGGER trg_opa_dispatches_updated_at BEFORE UPDATE ON opa_dispatches FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_dispatch_items ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), dispatch_id UUID NOT NULL REFERENCES opa_dispatches (id) ON DELETE CASCADE, so_item_id UUID REFERENCES opa_sales_order_items (id) ON DELETE SET NULL, greige_id UUID REFERENCES opa_greige_stock (id) ON DELETE SET NULL, description TEXT NOT NULL, quantity NUMERIC(14, 3) NOT NULL, uom TEXT NOT NULL DEFAULT 'MTR', remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID );
CREATE INDEX IF NOT EXISTS idx_opa_dispatch_items_dispatch ON opa_dispatch_items (dispatch_id);
DROP TRIGGER IF EXISTS trg_opa_dispatch_items_updated_at ON opa_dispatch_items;
CREATE TRIGGER trg_opa_dispatch_items_updated_at BEFORE UPDATE ON opa_dispatch_items FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_payments ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), payment_number TEXT NOT NULL, supplier_id UUID NOT NULL REFERENCES opa_suppliers (id) ON DELETE RESTRICT, po_id UUID REFERENCES opa_purchase_orders (id) ON DELETE SET NULL, payment_date DATE NOT NULL DEFAULT CURRENT_DATE, amount NUMERIC(14, 2) NOT NULL, mode opa_payment_mode NOT NULL DEFAULT 'NEFT', reference_no TEXT, status opa_payment_status NOT NULL DEFAULT 'PENDING', remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_payments_number_unique UNIQUE (payment_number) );
CREATE INDEX IF NOT EXISTS idx_opa_payments_supplier ON opa_payments (supplier_id);
CREATE INDEX IF NOT EXISTS idx_opa_payments_date ON opa_payments (payment_date);
DROP TRIGGER IF EXISTS trg_opa_payments_updated_at ON opa_payments;
CREATE TRIGGER trg_opa_payments_updated_at BEFORE UPDATE ON opa_payments FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_receipts ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), receipt_number TEXT NOT NULL, customer_id UUID NOT NULL REFERENCES opa_customers (id) ON DELETE RESTRICT, so_id UUID REFERENCES opa_sales_orders (id) ON DELETE SET NULL, receipt_date DATE NOT NULL DEFAULT CURRENT_DATE, amount NUMERIC(14, 2) NOT NULL, mode opa_payment_mode NOT NULL DEFAULT 'NEFT', reference_no TEXT, status opa_payment_status NOT NULL DEFAULT 'PENDING', remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_receipts_number_unique UNIQUE (receipt_number) );
CREATE INDEX IF NOT EXISTS idx_opa_receipts_customer ON opa_receipts (customer_id);
CREATE INDEX IF NOT EXISTS idx_opa_receipts_date ON opa_receipts (receipt_date);
DROP TRIGGER IF EXISTS trg_opa_receipts_updated_at ON opa_receipts;
CREATE TRIGGER trg_opa_receipts_updated_at BEFORE UPDATE ON opa_receipts FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_costing_entries ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), costing_number TEXT NOT NULL, entry_date DATE NOT NULL DEFAULT CURRENT_DATE, article_id UUID REFERENCES opa_articles (id) ON DELETE SET NULL, loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL, production_entry_id UUID REFERENCES opa_production_entries (id) ON DELETE SET NULL, yarn_cost NUMERIC(14, 2) DEFAULT 0, labour_cost NUMERIC(14, 2) DEFAULT 0, power_cost NUMERIC(14, 2) DEFAULT 0, overhead_cost NUMERIC(14, 2) DEFAULT 0, maintenance_cost NUMERIC(14, 2) DEFAULT 0, other_cost NUMERIC(14, 2) DEFAULT 0, total_cost NUMERIC(14, 2) GENERATED ALWAYS AS ( COALESCE(yarn_cost, 0) + COALESCE(labour_cost, 0) + COALESCE(power_cost, 0) + COALESCE(overhead_cost, 0) + COALESCE(maintenance_cost, 0) + COALESCE(other_cost, 0) ) STORED, meters NUMERIC(14, 3) DEFAULT 0, cost_per_meter NUMERIC(14, 4), formula_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb, remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_costing_entries_number_unique UNIQUE (costing_number) );
CREATE INDEX IF NOT EXISTS idx_opa_costing_entries_date ON opa_costing_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_opa_costing_entries_article ON opa_costing_entries (article_id);
DROP TRIGGER IF EXISTS trg_opa_costing_entries_updated_at ON opa_costing_entries;
CREATE TRIGGER trg_opa_costing_entries_updated_at BEFORE UPDATE ON opa_costing_entries FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
ALTER TABLE opa_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_supplier_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_purchase_requisitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_purchase_requisition_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_rfqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_supplier_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_quotation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_grns ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_grn_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_sales_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_sales_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_dispatches ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_dispatch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_costing_entries ENABLE ROW LEVEL SECURITY;
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
CREATE TABLE IF NOT EXISTS opa_maintenance_requests ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), request_number TEXT NOT NULL, loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL, reported_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL, request_date TIMESTAMPTZ NOT NULL DEFAULT NOW(), issue_type TEXT, description TEXT NOT NULL, priority opa_maint_priority NOT NULL DEFAULT 'MEDIUM', status opa_maint_status NOT NULL DEFAULT 'OPEN', downtime_started_at TIMESTAMPTZ, remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_maintenance_requests_number_unique UNIQUE (request_number) );
CREATE INDEX IF NOT EXISTS idx_opa_maint_requests_status ON opa_maintenance_requests (status);
CREATE INDEX IF NOT EXISTS idx_opa_maint_requests_loom ON opa_maintenance_requests (loom_id);
CREATE INDEX IF NOT EXISTS idx_opa_maint_requests_priority ON opa_maintenance_requests (priority);
DROP TRIGGER IF EXISTS trg_opa_maintenance_requests_updated_at ON opa_maintenance_requests;
CREATE TRIGGER trg_opa_maintenance_requests_updated_at BEFORE UPDATE ON opa_maintenance_requests FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_maintenance_work_orders ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), wo_number TEXT NOT NULL, request_id UUID REFERENCES opa_maintenance_requests (id) ON DELETE SET NULL, loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL, assigned_to UUID REFERENCES opa_profiles (id) ON DELETE SET NULL, supervised_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL, priority opa_maint_priority NOT NULL DEFAULT 'MEDIUM', status opa_maint_status NOT NULL DEFAULT 'OPEN', scheduled_start TIMESTAMPTZ, scheduled_end TIMESTAMPTZ, actual_start TIMESTAMPTZ, actual_end TIMESTAMPTZ, work_description TEXT, root_cause TEXT, resolution TEXT, labour_hours NUMERIC(8, 2) DEFAULT 0, remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_maintenance_work_orders_number_unique UNIQUE (wo_number) );
CREATE INDEX IF NOT EXISTS idx_opa_maint_wo_status ON opa_maintenance_work_orders (status);
CREATE INDEX IF NOT EXISTS idx_opa_maint_wo_loom ON opa_maintenance_work_orders (loom_id);
CREATE INDEX IF NOT EXISTS idx_opa_maint_wo_assigned ON opa_maintenance_work_orders (assigned_to);
DROP TRIGGER IF EXISTS trg_opa_maintenance_work_orders_updated_at ON opa_maintenance_work_orders;
CREATE TRIGGER trg_opa_maintenance_work_orders_updated_at BEFORE UPDATE ON opa_maintenance_work_orders FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_maintenance_spare_usage ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), work_order_id UUID NOT NULL REFERENCES opa_maintenance_work_orders (id) ON DELETE CASCADE, spare_part_id UUID REFERENCES opa_spare_parts (id) ON DELETE SET NULL, inventory_item_id UUID REFERENCES opa_inventory_items (id) ON DELETE SET NULL, quantity NUMERIC(14, 3) NOT NULL, uom TEXT NOT NULL DEFAULT 'PCS', unit_cost NUMERIC(14, 4) DEFAULT 0, remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID );
CREATE INDEX IF NOT EXISTS idx_opa_maint_spare_wo ON opa_maintenance_spare_usage (work_order_id);
DROP TRIGGER IF EXISTS trg_opa_maintenance_spare_usage_updated_at ON opa_maintenance_spare_usage;
CREATE TRIGGER trg_opa_maintenance_spare_usage_updated_at BEFORE UPDATE ON opa_maintenance_spare_usage FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_pm_schedules ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), schedule_code TEXT NOT NULL, name TEXT NOT NULL, loom_id UUID REFERENCES opa_looms (id) ON DELETE CASCADE, loom_type opa_loom_type, frequency opa_pm_frequency NOT NULL DEFAULT 'MONTHLY', next_due_date DATE, last_completed_date DATE, is_active BOOLEAN NOT NULL DEFAULT TRUE, estimated_hours NUMERIC(8, 2) DEFAULT 0, remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_pm_schedules_code_unique UNIQUE (schedule_code) );
CREATE INDEX IF NOT EXISTS idx_opa_pm_schedules_due ON opa_pm_schedules (next_due_date);
CREATE INDEX IF NOT EXISTS idx_opa_pm_schedules_loom ON opa_pm_schedules (loom_id);
DROP TRIGGER IF EXISTS trg_opa_pm_schedules_updated_at ON opa_pm_schedules;
CREATE TRIGGER trg_opa_pm_schedules_updated_at BEFORE UPDATE ON opa_pm_schedules FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_pm_checklists ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), schedule_id UUID REFERENCES opa_pm_schedules (id) ON DELETE CASCADE, item_code TEXT, item_name TEXT NOT NULL, description TEXT, sort_order INTEGER NOT NULL DEFAULT 0, is_mandatory BOOLEAN NOT NULL DEFAULT TRUE, applies_to_loom_type opa_loom_type, is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID );
CREATE INDEX IF NOT EXISTS idx_opa_pm_checklists_schedule ON opa_pm_checklists (schedule_id);
CREATE INDEX IF NOT EXISTS idx_opa_pm_checklists_sort ON opa_pm_checklists (sort_order);
DROP TRIGGER IF EXISTS trg_opa_pm_checklists_updated_at ON opa_pm_checklists;
CREATE TRIGGER trg_opa_pm_checklists_updated_at BEFORE UPDATE ON opa_pm_checklists FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_pm_completions ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), completion_number TEXT NOT NULL, schedule_id UUID NOT NULL REFERENCES opa_pm_schedules (id) ON DELETE RESTRICT, loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL, completed_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), checklist_results JSONB NOT NULL DEFAULT '[]'::jsonb, status TEXT NOT NULL DEFAULT 'COMPLETED', remarks TEXT, next_due_date DATE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_pm_completions_number_unique UNIQUE (completion_number) );
CREATE INDEX IF NOT EXISTS idx_opa_pm_completions_schedule ON opa_pm_completions (schedule_id);
CREATE INDEX IF NOT EXISTS idx_opa_pm_completions_at ON opa_pm_completions (completed_at DESC);
DROP TRIGGER IF EXISTS trg_opa_pm_completions_updated_at ON opa_pm_completions;
CREATE TRIGGER trg_opa_pm_completions_updated_at BEFORE UPDATE ON opa_pm_completions FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_employees ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employee_code TEXT NOT NULL, full_name TEXT NOT NULL, profile_id UUID REFERENCES opa_profiles (id) ON DELETE SET NULL, department_id UUID REFERENCES opa_departments (id) ON DELETE SET NULL, designation TEXT, role opa_role, mobile TEXT, email TEXT, date_of_joining DATE, date_of_exit DATE, shift_id UUID REFERENCES opa_shifts (id) ON DELETE SET NULL, is_active BOOLEAN NOT NULL DEFAULT TRUE, meta JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_employees_code_unique UNIQUE (employee_code) );
CREATE INDEX IF NOT EXISTS idx_opa_employees_department ON opa_employees (department_id);
CREATE INDEX IF NOT EXISTS idx_opa_employees_active ON opa_employees (is_active);
CREATE INDEX IF NOT EXISTS idx_opa_employees_profile ON opa_employees (profile_id);
DROP TRIGGER IF EXISTS trg_opa_employees_updated_at ON opa_employees;
CREATE TRIGGER trg_opa_employees_updated_at BEFORE UPDATE ON opa_employees FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_attendance ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), employee_id UUID NOT NULL REFERENCES opa_employees (id) ON DELETE CASCADE, attendance_date DATE NOT NULL, shift_id UUID REFERENCES opa_shifts (id) ON DELETE SET NULL, status opa_attendance_status NOT NULL DEFAULT 'PRESENT', check_in TIMESTAMPTZ, check_out TIMESTAMPTZ, overtime_hours NUMERIC(6, 2) DEFAULT 0, remarks TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID, CONSTRAINT opa_attendance_employee_date_unique UNIQUE (employee_id, attendance_date) );
CREATE INDEX IF NOT EXISTS idx_opa_attendance_date ON opa_attendance (attendance_date);
CREATE INDEX IF NOT EXISTS idx_opa_attendance_employee ON opa_attendance (employee_id);
CREATE INDEX IF NOT EXISTS idx_opa_attendance_shift ON opa_attendance (shift_id);
DROP TRIGGER IF EXISTS trg_opa_attendance_updated_at ON opa_attendance;
CREATE TRIGGER trg_opa_attendance_updated_at BEFORE UPDATE ON opa_attendance FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
ALTER TABLE opa_maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_maintenance_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_maintenance_spare_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_pm_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_pm_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_pm_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_attendance ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_whatsapp_status') THEN
    CREATE TYPE opa_whatsapp_status AS ENUM (
      'QUEUED',
      'SENDING',
      'SENT',
      'DELIVERED',
      'READ',
      'FAILED',
      'CANCELLED'
    );
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS opa_whatsapp_outbox ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), channel TEXT NOT NULL DEFAULT 'whatsapp', to_number TEXT NOT NULL, template_name TEXT, body TEXT NOT NULL, meta JSONB NOT NULL DEFAULT '{}'::jsonb, status opa_whatsapp_status NOT NULL DEFAULT 'QUEUED', provider_message_id TEXT, error_message TEXT, related_module TEXT, related_record_id TEXT, attempts INTEGER NOT NULL DEFAULT 0, scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), sent_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), created_by UUID, updated_by UUID );
CREATE INDEX IF NOT EXISTS idx_opa_whatsapp_outbox_status ON opa_whatsapp_outbox (status, scheduled_at);
DROP TRIGGER IF EXISTS trg_opa_whatsapp_outbox_updated_at ON opa_whatsapp_outbox;
CREATE TRIGGER trg_opa_whatsapp_outbox_updated_at BEFORE UPDATE ON opa_whatsapp_outbox FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();
CREATE TABLE IF NOT EXISTS opa_whatsapp_webhooks ( id UUID PRIMARY KEY DEFAULT gen_random_uuid(), provider TEXT NOT NULL DEFAULT 'meta', event_type TEXT, payload JSONB NOT NULL DEFAULT '{}'::jsonb, processed BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW() );
CREATE INDEX IF NOT EXISTS idx_opa_whatsapp_webhooks_processed ON opa_whatsapp_webhooks (processed, created_at DESC);
COMMENT ON TABLE opa_whatsapp_outbox IS 'ERP WhatsApp outbox. Visitor/CEO flows use ceo_visit_requests + Edge Functions from Security module.';
INSERT INTO opa_company_settings ( company_name, address, timezone, currency, fiscal_year, loom_count, dobby_count, plain_count, costing_formulas, approval_thresholds, whatsapp_settings ) SELECT 'OPA GROUP OF INDIA', 'India', 'Asia/Kolkata', 'INR', 'April-March', 72, 36, 36, jsonb_build_object( 'yarn_cost_per_kg', 0, 'labour_cost_per_meter', 0, 'power_cost_per_hour', 0, 'overhead_pct', 0 ), jsonb_build_object( 'purchase_l1', 50000, 'purchase_l2', 200000, 'purchase_ceo', 500000 ), jsonb_build_object( 'ceo_visit_enabled', true, 'notify_ceo_on_visit', true ) WHERE NOT EXISTS (SELECT 1 FROM opa_company_settings LIMIT 1);
INSERT INTO opa_departments (code, name, description) VALUES ('PROD', 'Production', 'Loom shed production'), ('MAINT', 'Maintenance', 'Mechanical & electronic maintenance'), ('STORE', 'Stores', 'Yarn, spare and general stores'), ('PUR', 'Purchase', 'Procurement'), ('SALES', 'Sales', 'Sales & dispatch'), ('QC', 'Quality', 'Quality assurance'), ('ACC', 'Accounts', 'Accounts & finance'), ('HR', 'Human Resources', 'HR & attendance'), ('SEC', 'Security', 'Gate & visitor security'), ('ADMIN', 'Administration', 'Factory administration') ON CONFLICT (code) DO NOTHING;
INSERT INTO opa_shifts (code, name, start_time, end_time, is_active) VALUES ('A', 'SHIFT A', '06:00', '14:00', TRUE), ('B', 'SHIFT B', '14:00', '22:00', TRUE), ('C', 'SHIFT C', '22:00', '06:00', TRUE) ON CONFLICT (code) DO NOTHING;
INSERT INTO opa_stores (code, name, store_type, location) VALUES ('YARN', 'YARN STORE', 'YARN', 'Main plant'), ('GREIGE', 'GREIGE STORE', 'GREIGE', 'Main plant'), ('SPARE', 'SPARE PARTS STORE', 'SPARES', 'Main plant'), ('GEN', 'GENERAL STORE', 'GENERAL', 'Main plant'), ('CHEM', 'CHEMICAL STORE', 'CHEMICAL', 'Main plant') ON CONFLICT (code) DO NOTHING;
INSERT INTO opa_looms (loom_number, loom_type, status, is_active) SELECT CASE WHEN g <= 36 THEN 'DOBBY LOOM ' || LPAD(g::TEXT, 2, '0') ELSE 'PLAIN LOOM ' || LPAD(g::TEXT, 2, '0') END, CASE WHEN g <= 36 THEN 'DOBBY'::opa_loom_type ELSE 'PLAIN'::opa_loom_type END, 'IDLE'::opa_loom_status, TRUE FROM generate_series(1, 72) AS g ON CONFLICT (loom_number) DO NOTHING;
WITH modules AS ( SELECT unnest(ARRAY[ 'dashboard', 'production', 'looms', 'inventory', 'yarn', 'purchase', 'sales', 'maintenance', 'quality', 'hr', 'security', 'accounts', 'settings', 'approvals', 'audit', 'documents', 'costing' ]) AS module ), roles AS ( SELECT unnest(enum_range(NULL::opa_role)) AS role ) INSERT INTO opa_role_permissions ( role, module, can_view, can_create, can_edit, can_delete, can_approve, can_export ) SELECT r.role, m.module, TRUE AS can_view, CASE WHEN r.role IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR', 'FACTORY_MANAGER') THEN TRUE WHEN r.role = 'PRODUCTION_MANAGER' AND m.module IN ('production', 'looms', 'dashboard') THEN TRUE WHEN r.role = 'PRODUCTION_SUPERVISOR' AND m.module IN ('production', 'looms') THEN TRUE WHEN r.role = 'LOOM_OPERATOR' AND m.module IN ('production') THEN TRUE WHEN r.role = 'MAINTENANCE_HEAD' AND m.module IN ('maintenance', 'looms') THEN TRUE WHEN r.role = 'TECHNICIAN' AND m.module IN ('maintenance') THEN TRUE WHEN r.role = 'STORE_MANAGER' AND m.module IN ('inventory', 'yarn') THEN TRUE WHEN r.role = 'PURCHASE_MANAGER' AND m.module IN ('purchase') THEN TRUE WHEN r.role = 'SALES_MANAGER' AND m.module IN ('sales') THEN TRUE WHEN r.role = 'ACCOUNTS' AND m.module IN ('accounts', 'costing', 'purchase', 'sales') THEN TRUE WHEN r.role = 'HR' AND m.module IN ('hr') THEN TRUE WHEN r.role = 'SECURITY_HEAD' AND m.module IN ('security') THEN TRUE WHEN r.role = 'SECURITY_GUARD' AND m.module IN ('security') THEN TRUE WHEN r.role = 'QUALITY_MANAGER' AND m.module IN ('quality', 'production') THEN TRUE ELSE FALSE END AS can_create, CASE WHEN r.role IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR', 'FACTORY_MANAGER') THEN TRUE WHEN r.role = 'PRODUCTION_MANAGER' AND m.module IN ('production', 'looms', 'dashboard') THEN TRUE WHEN r.role = 'PRODUCTION_SUPERVISOR' AND m.module IN ('production', 'looms') THEN TRUE WHEN r.role = 'MAINTENANCE_HEAD' AND m.module IN ('maintenance', 'looms') THEN TRUE WHEN r.role = 'TECHNICIAN' AND m.module IN ('maintenance') THEN TRUE WHEN r.role = 'STORE_MANAGER' AND m.module IN ('inventory', 'yarn') THEN TRUE WHEN r.role = 'PURCHASE_MANAGER' AND m.module IN ('purchase') THEN TRUE WHEN r.role = 'SALES_MANAGER' AND m.module IN ('sales') THEN TRUE WHEN r.role = 'ACCOUNTS' AND m.module IN ('accounts', 'costing') THEN TRUE WHEN r.role = 'HR' AND m.module IN ('hr') THEN TRUE WHEN r.role = 'SECURITY_HEAD' AND m.module IN ('security') THEN TRUE WHEN r.role = 'SECURITY_GUARD' AND m.module IN ('security') THEN TRUE WHEN r.role = 'QUALITY_MANAGER' AND m.module IN ('quality') THEN TRUE ELSE FALSE END AS can_edit, CASE WHEN r.role IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR') THEN TRUE WHEN r.role = 'FACTORY_MANAGER' AND m.module NOT IN ('settings', 'audit') THEN TRUE ELSE FALSE END AS can_delete, CASE WHEN r.role IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR', 'FACTORY_MANAGER') THEN TRUE WHEN r.role IN ('PRODUCTION_MANAGER', 'PURCHASE_MANAGER', 'SALES_MANAGER', 'MAINTENANCE_HEAD', 'ACCOUNTS') AND m.module IN ('approvals', 'purchase', 'sales', 'production', 'maintenance', 'accounts') THEN TRUE ELSE FALSE END AS can_approve, CASE WHEN r.role IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR', 'FACTORY_MANAGER', 'ACCOUNTS') THEN TRUE WHEN r.role IN ('PRODUCTION_MANAGER', 'PURCHASE_MANAGER', 'SALES_MANAGER', 'STORE_MANAGER', 'QUALITY_MANAGER', 'HR') THEN TRUE ELSE FALSE END AS can_export FROM roles r CROSS JOIN modules m ON CONFLICT (role, module) DO NOTHING;
UPDATE opa_role_permissions SET can_view = FALSE, can_create = FALSE, can_edit = FALSE, can_delete = FALSE, can_approve = FALSE, can_export = FALSE WHERE module IN ('settings', 'audit') AND role NOT IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR', 'FACTORY_MANAGER');
UPDATE opa_role_permissions SET can_view = TRUE, can_edit = (role = 'SUPER_ADMIN'), can_export = TRUE WHERE module = 'settings' AND role IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR', 'FACTORY_MANAGER');
UPDATE opa_role_permissions SET can_view = TRUE, can_export = TRUE WHERE module = 'audit' AND role IN ('SUPER_ADMIN', 'CEO', 'DIRECTOR', 'FACTORY_MANAGER');
INSERT INTO opa_pm_checklists (item_code, item_name, description, sort_order, is_mandatory, is_active) SELECT v.item_code, v.item_name, v.description, v.sort_order, TRUE, TRUE FROM ( VALUES ('PM-01', 'Check air pressure', 'Verify main air pressure within operating range', 10), ('PM-02', 'Lubricate bearings', 'Lubricate critical loom bearings per schedule', 20), ('PM-03', 'Inspect reed & healds', 'Check reed, healds and drop wires for damage', 30), ('PM-04', 'Check weft accumulator', 'Inspect weft feeder / accumulator function', 40), ('PM-05', 'Inspect nozzle & relay', 'Clean and inspect main / relay nozzles', 50), ('PM-06', 'Check electronic controller', 'Verify controller LEDs, alarms and backups', 60), ('PM-07', 'Dobby / cam inspection', 'Inspect dobby unit or cam mechanism (as applicable)', 70), ('PM-08', 'Motor & drive check', 'Check motor temperature, belts and couplings', 80), ('PM-09', 'Safety guards', 'Ensure all guards and emergency stops functional', 90), ('PM-10', 'Clean loom & surroundings', 'Housekeeping around loom and under-machine area', 100) ) AS v(item_code, item_name, description, sort_order) WHERE NOT EXISTS ( SELECT 1 FROM opa_pm_checklists c WHERE c.item_code = v.item_code AND c.schedule_id IS NULL );
CREATE OR REPLACE FUNCTION opa_current_role() RETURNS opa_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role
  FROM opa_profiles
  WHERE id = auth.uid()
    AND is_active = TRUE
  LIMIT 1;
$$;
CREATE OR REPLACE FUNCTION opa_is_elevated() RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    opa_current_role() IN (
      'SUPER_ADMIN'::opa_role,
      'CEO'::opa_role,
      'DIRECTOR'::opa_role,
      'FACTORY_MANAGER'::opa_role
    ),
    FALSE
  );
$$;
CREATE OR REPLACE FUNCTION opa_has_permission(p_module TEXT, p_action TEXT) RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role opa_role;
  v_ok BOOLEAN := FALSE;
BEGIN
  v_role := opa_current_role();
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role = 'SUPER_ADMIN' THEN
    RETURN TRUE;
  END IF;

  SELECT CASE lower(p_action)
    WHEN 'view' THEN can_view
    WHEN 'create' THEN can_create
    WHEN 'edit' THEN can_edit
    WHEN 'delete' THEN can_delete
    WHEN 'approve' THEN can_approve
    WHEN 'export' THEN can_export
    ELSE FALSE
  END
  INTO v_ok
  FROM opa_role_permissions
  WHERE role = v_role
    AND module = p_module
  LIMIT 1;

  RETURN COALESCE(v_ok, FALSE);
END;
$$;
GRANT EXECUTE ON FUNCTION opa_current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION opa_is_elevated() TO authenticated;
GRANT EXECUTE ON FUNCTION opa_has_permission(TEXT, TEXT) TO authenticated;
DROP POLICY IF EXISTS opa_company_settings_select ON opa_company_settings;
CREATE POLICY opa_company_settings_select ON opa_company_settings FOR SELECT TO authenticated USING (opa_has_permission('settings', 'view') OR opa_has_permission('dashboard', 'view'));
DROP POLICY IF EXISTS opa_company_settings_write ON opa_company_settings;
CREATE POLICY opa_company_settings_write ON opa_company_settings FOR ALL TO authenticated USING (opa_has_permission('settings', 'edit')) WITH CHECK (opa_has_permission('settings', 'edit'));
DROP POLICY IF EXISTS opa_departments_select ON opa_departments;
CREATE POLICY opa_departments_select ON opa_departments FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS opa_departments_write ON opa_departments;
CREATE POLICY opa_departments_write ON opa_departments FOR ALL TO authenticated USING (opa_is_elevated() OR opa_has_permission('settings', 'edit')) WITH CHECK (opa_is_elevated() OR opa_has_permission('settings', 'edit'));
DROP POLICY IF EXISTS opa_shifts_select ON opa_shifts;
CREATE POLICY opa_shifts_select ON opa_shifts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS opa_shifts_write ON opa_shifts;
CREATE POLICY opa_shifts_write ON opa_shifts FOR ALL TO authenticated USING (opa_is_elevated() OR opa_has_permission('settings', 'edit')) WITH CHECK (opa_is_elevated() OR opa_has_permission('settings', 'edit'));
DROP POLICY IF EXISTS opa_profiles_select ON opa_profiles;
CREATE POLICY opa_profiles_select ON opa_profiles FOR SELECT TO authenticated USING ( id = auth.uid() OR opa_is_elevated() OR opa_has_permission('hr', 'view') );
DROP POLICY IF EXISTS opa_profiles_update_self ON opa_profiles;
CREATE POLICY opa_profiles_update_self ON opa_profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
DROP POLICY IF EXISTS opa_profiles_admin ON opa_profiles;
CREATE POLICY opa_profiles_admin ON opa_profiles FOR ALL TO authenticated USING (opa_is_elevated() OR opa_has_permission('hr', 'edit')) WITH CHECK (opa_is_elevated() OR opa_has_permission('hr', 'edit'));
DROP POLICY IF EXISTS opa_role_permissions_select ON opa_role_permissions;
CREATE POLICY opa_role_permissions_select ON opa_role_permissions FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS opa_role_permissions_write ON opa_role_permissions;
CREATE POLICY opa_role_permissions_write ON opa_role_permissions FOR ALL TO authenticated USING (opa_current_role() = 'SUPER_ADMIN') WITH CHECK (opa_current_role() = 'SUPER_ADMIN');
DROP POLICY IF EXISTS opa_audit_logs_select ON opa_audit_logs;
CREATE POLICY opa_audit_logs_select ON opa_audit_logs FOR SELECT TO authenticated USING (opa_has_permission('audit', 'view') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_audit_logs_insert ON opa_audit_logs;
CREATE POLICY opa_audit_logs_insert ON opa_audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS opa_notifications_select ON opa_notifications;
CREATE POLICY opa_notifications_select ON opa_notifications FOR SELECT TO authenticated USING (user_id = auth.uid() OR opa_is_elevated());
DROP POLICY IF EXISTS opa_notifications_update ON opa_notifications;
CREATE POLICY opa_notifications_update ON opa_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid() OR opa_is_elevated()) WITH CHECK (user_id = auth.uid() OR opa_is_elevated());
DROP POLICY IF EXISTS opa_notifications_insert ON opa_notifications;
CREATE POLICY opa_notifications_insert ON opa_notifications FOR INSERT TO authenticated WITH CHECK (opa_is_elevated() OR user_id = auth.uid());
DROP POLICY IF EXISTS opa_documents_all ON opa_documents;
CREATE POLICY opa_documents_all ON opa_documents FOR ALL TO authenticated USING (opa_has_permission('documents', 'view') OR opa_is_elevated()) WITH CHECK ( opa_has_permission('documents', 'create') OR opa_has_permission('documents', 'edit') OR opa_is_elevated() );
DROP POLICY IF EXISTS opa_approvals_select ON opa_approvals;
CREATE POLICY opa_approvals_select ON opa_approvals FOR SELECT TO authenticated USING ( requested_by = auth.uid() OR reviewed_by = auth.uid() OR opa_has_permission('approvals', 'view') OR opa_is_elevated() );
DROP POLICY IF EXISTS opa_approvals_write ON opa_approvals;
CREATE POLICY opa_approvals_write ON opa_approvals FOR ALL TO authenticated USING ( opa_has_permission('approvals', 'edit') OR opa_has_permission('approvals', 'approve') OR opa_is_elevated() ) WITH CHECK ( opa_has_permission('approvals', 'create') OR opa_has_permission('approvals', 'approve') OR opa_is_elevated() );
DROP POLICY IF EXISTS opa_alerts_select ON opa_alerts;
CREATE POLICY opa_alerts_select ON opa_alerts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS opa_alerts_write ON opa_alerts;
CREATE POLICY opa_alerts_write ON opa_alerts FOR ALL TO authenticated USING (opa_is_elevated() OR opa_has_permission('dashboard', 'edit')) WITH CHECK (opa_is_elevated() OR opa_has_permission('dashboard', 'edit'));
DROP POLICY IF EXISTS opa_looms_select ON opa_looms;
CREATE POLICY opa_looms_select ON opa_looms FOR SELECT TO authenticated USING (opa_has_permission('looms', 'view') OR opa_has_permission('production', 'view') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_looms_write ON opa_looms;
CREATE POLICY opa_looms_write ON opa_looms FOR ALL TO authenticated USING (opa_has_permission('looms', 'edit') OR opa_is_elevated()) WITH CHECK (opa_has_permission('looms', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_articles_all ON opa_articles;
CREATE POLICY opa_articles_all ON opa_articles FOR ALL TO authenticated USING (opa_has_permission('production', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('production', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_production_plans_all ON opa_production_plans;
CREATE POLICY opa_production_plans_all ON opa_production_plans FOR ALL TO authenticated USING (opa_has_permission('production', 'view') OR opa_is_elevated()) WITH CHECK ( opa_has_permission('production', 'create') OR opa_has_permission('production', 'edit') OR opa_is_elevated() );
DROP POLICY IF EXISTS opa_production_entries_all ON opa_production_entries;
CREATE POLICY opa_production_entries_all ON opa_production_entries FOR ALL TO authenticated USING (opa_has_permission('production', 'view') OR opa_is_elevated()) WITH CHECK ( opa_has_permission('production', 'create') OR opa_has_permission('production', 'edit') OR opa_is_elevated() );
DROP POLICY IF EXISTS opa_production_targets_all ON opa_production_targets;
CREATE POLICY opa_production_targets_all ON opa_production_targets FOR ALL TO authenticated USING (opa_has_permission('production', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('production', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_loom_stoppages_all ON opa_loom_stoppages;
CREATE POLICY opa_loom_stoppages_all ON opa_loom_stoppages FOR ALL TO authenticated USING ( opa_has_permission('production', 'view') OR opa_has_permission('maintenance', 'view') OR opa_is_elevated() ) WITH CHECK ( opa_has_permission('production', 'create') OR opa_has_permission('maintenance', 'create') OR opa_is_elevated() );
DROP POLICY IF EXISTS opa_quality_inspections_all ON opa_quality_inspections;
CREATE POLICY opa_quality_inspections_all ON opa_quality_inspections FOR ALL TO authenticated USING (opa_has_permission('quality', 'view') OR opa_is_elevated()) WITH CHECK ( opa_has_permission('quality', 'create') OR opa_has_permission('quality', 'edit') OR opa_is_elevated() );
DROP POLICY IF EXISTS opa_quality_defects_all ON opa_quality_defects;
CREATE POLICY opa_quality_defects_all ON opa_quality_defects FOR ALL TO authenticated USING (opa_has_permission('quality', 'view') OR opa_is_elevated()) WITH CHECK ( opa_has_permission('quality', 'create') OR opa_has_permission('quality', 'edit') OR opa_is_elevated() );
DROP POLICY IF EXISTS opa_stores_all ON opa_stores;
CREATE POLICY opa_stores_all ON opa_stores FOR ALL TO authenticated USING (opa_has_permission('inventory', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('inventory', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_inventory_items_all ON opa_inventory_items;
CREATE POLICY opa_inventory_items_all ON opa_inventory_items FOR ALL TO authenticated USING (opa_has_permission('inventory', 'view') OR opa_is_elevated()) WITH CHECK ( opa_has_permission('inventory', 'create') OR opa_has_permission('inventory', 'edit') OR opa_is_elevated() );
DROP POLICY IF EXISTS opa_stock_movements_all ON opa_stock_movements;
CREATE POLICY opa_stock_movements_all ON opa_stock_movements FOR ALL TO authenticated USING (opa_has_permission('inventory', 'view') OR opa_is_elevated()) WITH CHECK ( opa_has_permission('inventory', 'create') OR opa_has_permission('inventory', 'edit') OR opa_is_elevated() );
DROP POLICY IF EXISTS opa_yarn_master_all ON opa_yarn_master;
CREATE POLICY opa_yarn_master_all ON opa_yarn_master FOR ALL TO authenticated USING (opa_has_permission('yarn', 'view') OR opa_has_permission('inventory', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('yarn', 'edit') OR opa_has_permission('inventory', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_yarn_transactions_all ON opa_yarn_transactions;
CREATE POLICY opa_yarn_transactions_all ON opa_yarn_transactions FOR ALL TO authenticated USING (opa_has_permission('yarn', 'view') OR opa_has_permission('inventory', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('yarn', 'create') OR opa_has_permission('inventory', 'create') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_beams_all ON opa_beams;
CREATE POLICY opa_beams_all ON opa_beams FOR ALL TO authenticated USING ( opa_has_permission('yarn', 'view') OR opa_has_permission('production', 'view') OR opa_is_elevated() ) WITH CHECK ( opa_has_permission('yarn', 'edit') OR opa_has_permission('production', 'edit') OR opa_is_elevated() );
DROP POLICY IF EXISTS opa_greige_stock_all ON opa_greige_stock;
CREATE POLICY opa_greige_stock_all ON opa_greige_stock FOR ALL TO authenticated USING (opa_has_permission('inventory', 'view') OR opa_has_permission('production', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('inventory', 'edit') OR opa_has_permission('production', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_greige_movements_all ON opa_greige_movements;
CREATE POLICY opa_greige_movements_all ON opa_greige_movements FOR ALL TO authenticated USING (opa_has_permission('inventory', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('inventory', 'create') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_spare_parts_all ON opa_spare_parts;
CREATE POLICY opa_spare_parts_all ON opa_spare_parts FOR ALL TO authenticated USING ( opa_has_permission('inventory', 'view') OR opa_has_permission('maintenance', 'view') OR opa_is_elevated() ) WITH CHECK ( opa_has_permission('inventory', 'edit') OR opa_has_permission('maintenance', 'edit') OR opa_is_elevated() );
DROP POLICY IF EXISTS opa_suppliers_all ON opa_suppliers;
CREATE POLICY opa_suppliers_all ON opa_suppliers FOR ALL TO authenticated USING (opa_has_permission('purchase', 'view') OR opa_has_permission('accounts', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('purchase', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_supplier_transactions_all ON opa_supplier_transactions;
CREATE POLICY opa_supplier_transactions_all ON opa_supplier_transactions FOR ALL TO authenticated USING (opa_has_permission('purchase', 'view') OR opa_has_permission('accounts', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('accounts', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_purchase_requisitions_all ON opa_purchase_requisitions;
CREATE POLICY opa_purchase_requisitions_all ON opa_purchase_requisitions FOR ALL TO authenticated USING (opa_has_permission('purchase', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_purchase_requisition_items_all ON opa_purchase_requisition_items;
CREATE POLICY opa_purchase_requisition_items_all ON opa_purchase_requisition_items FOR ALL TO authenticated USING (opa_has_permission('purchase', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_rfqs_all ON opa_rfqs;
CREATE POLICY opa_rfqs_all ON opa_rfqs FOR ALL TO authenticated USING (opa_has_permission('purchase', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_supplier_quotations_all ON opa_supplier_quotations;
CREATE POLICY opa_supplier_quotations_all ON opa_supplier_quotations FOR ALL TO authenticated USING (opa_has_permission('purchase', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_quotation_items_all ON opa_quotation_items;
CREATE POLICY opa_quotation_items_all ON opa_quotation_items FOR ALL TO authenticated USING (opa_has_permission('purchase', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_purchase_orders_all ON opa_purchase_orders;
CREATE POLICY opa_purchase_orders_all ON opa_purchase_orders FOR ALL TO authenticated USING (opa_has_permission('purchase', 'view') OR opa_has_permission('accounts', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_purchase_order_items_all ON opa_purchase_order_items;
CREATE POLICY opa_purchase_order_items_all ON opa_purchase_order_items FOR ALL TO authenticated USING (opa_has_permission('purchase', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('purchase', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_grns_all ON opa_grns;
CREATE POLICY opa_grns_all ON opa_grns FOR ALL TO authenticated USING (opa_has_permission('purchase', 'view') OR opa_has_permission('inventory', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('inventory', 'create') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_grn_items_all ON opa_grn_items;
CREATE POLICY opa_grn_items_all ON opa_grn_items FOR ALL TO authenticated USING (opa_has_permission('purchase', 'view') OR opa_has_permission('inventory', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('purchase', 'create') OR opa_has_permission('inventory', 'create') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_customers_all ON opa_customers;
CREATE POLICY opa_customers_all ON opa_customers FOR ALL TO authenticated USING (opa_has_permission('sales', 'view') OR opa_has_permission('accounts', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('sales', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_sales_orders_all ON opa_sales_orders;
CREATE POLICY opa_sales_orders_all ON opa_sales_orders FOR ALL TO authenticated USING (opa_has_permission('sales', 'view') OR opa_has_permission('accounts', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('sales', 'create') OR opa_has_permission('sales', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_sales_order_items_all ON opa_sales_order_items;
CREATE POLICY opa_sales_order_items_all ON opa_sales_order_items FOR ALL TO authenticated USING (opa_has_permission('sales', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('sales', 'create') OR opa_has_permission('sales', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_dispatches_all ON opa_dispatches;
CREATE POLICY opa_dispatches_all ON opa_dispatches FOR ALL TO authenticated USING (opa_has_permission('sales', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('sales', 'create') OR opa_has_permission('sales', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_dispatch_items_all ON opa_dispatch_items;
CREATE POLICY opa_dispatch_items_all ON opa_dispatch_items FOR ALL TO authenticated USING (opa_has_permission('sales', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('sales', 'create') OR opa_has_permission('sales', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_payments_all ON opa_payments;
CREATE POLICY opa_payments_all ON opa_payments FOR ALL TO authenticated USING (opa_has_permission('accounts', 'view') OR opa_has_permission('purchase', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('accounts', 'create') OR opa_has_permission('accounts', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_receipts_all ON opa_receipts;
CREATE POLICY opa_receipts_all ON opa_receipts FOR ALL TO authenticated USING (opa_has_permission('accounts', 'view') OR opa_has_permission('sales', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('accounts', 'create') OR opa_has_permission('accounts', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_costing_entries_all ON opa_costing_entries;
CREATE POLICY opa_costing_entries_all ON opa_costing_entries FOR ALL TO authenticated USING (opa_has_permission('costing', 'view') OR opa_has_permission('accounts', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('costing', 'create') OR opa_has_permission('accounts', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_maintenance_requests_all ON opa_maintenance_requests;
CREATE POLICY opa_maintenance_requests_all ON opa_maintenance_requests FOR ALL TO authenticated USING ( opa_has_permission('maintenance', 'view') OR opa_has_permission('production', 'view') OR opa_is_elevated() ) WITH CHECK ( opa_has_permission('maintenance', 'create') OR opa_has_permission('production', 'create') OR opa_is_elevated() );
DROP POLICY IF EXISTS opa_maintenance_work_orders_all ON opa_maintenance_work_orders;
CREATE POLICY opa_maintenance_work_orders_all ON opa_maintenance_work_orders FOR ALL TO authenticated USING (opa_has_permission('maintenance', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('maintenance', 'create') OR opa_has_permission('maintenance', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_maintenance_spare_usage_all ON opa_maintenance_spare_usage;
CREATE POLICY opa_maintenance_spare_usage_all ON opa_maintenance_spare_usage FOR ALL TO authenticated USING (opa_has_permission('maintenance', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('maintenance', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_pm_schedules_all ON opa_pm_schedules;
CREATE POLICY opa_pm_schedules_all ON opa_pm_schedules FOR ALL TO authenticated USING (opa_has_permission('maintenance', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('maintenance', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_pm_checklists_all ON opa_pm_checklists;
CREATE POLICY opa_pm_checklists_all ON opa_pm_checklists FOR ALL TO authenticated USING (opa_has_permission('maintenance', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('maintenance', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_pm_completions_all ON opa_pm_completions;
CREATE POLICY opa_pm_completions_all ON opa_pm_completions FOR ALL TO authenticated USING (opa_has_permission('maintenance', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('maintenance', 'create') OR opa_has_permission('maintenance', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_employees_all ON opa_employees;
CREATE POLICY opa_employees_all ON opa_employees FOR ALL TO authenticated USING (opa_has_permission('hr', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('hr', 'create') OR opa_has_permission('hr', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_attendance_all ON opa_attendance;
CREATE POLICY opa_attendance_all ON opa_attendance FOR ALL TO authenticated USING (opa_has_permission('hr', 'view') OR opa_is_elevated()) WITH CHECK (opa_has_permission('hr', 'create') OR opa_has_permission('hr', 'edit') OR opa_is_elevated());
DROP POLICY IF EXISTS opa_whatsapp_outbox_select ON opa_whatsapp_outbox;
CREATE POLICY opa_whatsapp_outbox_select ON opa_whatsapp_outbox FOR SELECT TO authenticated USING (opa_is_elevated() OR opa_current_role() = 'SUPER_ADMIN');
DROP POLICY IF EXISTS opa_whatsapp_outbox_service ON opa_whatsapp_outbox;
CREATE POLICY opa_whatsapp_outbox_service ON opa_whatsapp_outbox FOR ALL TO authenticated USING (opa_current_role() = 'SUPER_ADMIN') WITH CHECK (opa_current_role() = 'SUPER_ADMIN');
DROP POLICY IF EXISTS opa_whatsapp_webhooks_select ON opa_whatsapp_webhooks;
CREATE POLICY opa_whatsapp_webhooks_select ON opa_whatsapp_webhooks FOR SELECT TO authenticated USING (opa_current_role() = 'SUPER_ADMIN' OR opa_is_elevated());
DROP POLICY IF EXISTS opa_whatsapp_webhooks_insert ON opa_whatsapp_webhooks;
CREATE POLICY opa_whatsapp_webhooks_insert ON opa_whatsapp_webhooks FOR INSERT TO authenticated WITH CHECK (opa_current_role() = 'SUPER_ADMIN');
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'opa_looms',
    'opa_production_entries',
    'opa_loom_stoppages',
    'opa_alerts',
    'opa_notifications',
    'opa_maintenance_requests',
    'opa_maintenance_work_orders',
    'ceo_visit_requests',
    'visitor_requests',
    'opa_approvals',
    'opa_whatsapp_outbox'
  ];
BEGIN
  BEGIN
    CREATE PUBLICATION opa_realtime;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;

  FOREACH t IN ARRAY tables LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION opa_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN
      NULL;
    WHEN undefined_table THEN
      NULL;
    END;
  END LOOP;
END $$;
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 'opa_%'
  LOOP
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', r.tablename);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', r.tablename);
  END LOOP;
END $$;
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
ALTER TABLE opa_looms ADD COLUMN IF NOT EXISTS loom_code TEXT;
ALTER TABLE opa_looms ADD COLUMN IF NOT EXISTS production_capacity NUMERIC(14, 3);
ALTER TABLE opa_looms ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE opa_looms ADD COLUMN IF NOT EXISTS operator_name TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_opa_looms_loom_code_unique ON opa_looms (loom_code) WHERE loom_code IS NOT NULL;
WITH ranked AS ( SELECT id, loom_type, ROW_NUMBER() OVER (PARTITION BY loom_type ORDER BY loom_number, created_at) AS rn FROM opa_looms ) UPDATE opa_looms l SET loom_code = CASE WHEN r.loom_type = 'DOBBY' THEN 'D' || LPAD(r.rn::TEXT, 2, '0') ELSE 'P' || LPAD(r.rn::TEXT, 2, '0') END FROM ranked r WHERE l.id = r.id AND (l.loom_code IS NULL OR btrim(l.loom_code) = '');
UPDATE opa_looms SET loom_number = loom_code WHERE loom_code IS NOT NULL AND ( loom_number LIKE 'DOBBY LOOM %' OR loom_number LIKE 'PLAIN LOOM %' );
INSERT INTO opa_looms (loom_number, loom_code, loom_type, status, is_active, location, department, make, model, production_capacity) SELECT CASE WHEN g <= 36 THEN 'D' || LPAD(g::TEXT, 2, '0') ELSE 'P' || LPAD((g - 36)::TEXT, 2, '0') END, CASE WHEN g <= 36 THEN 'D' || LPAD(g::TEXT, 2, '0') ELSE 'P' || LPAD((g - 36)::TEXT, 2, '0') END, CASE WHEN g <= 36 THEN 'DOBBY'::opa_loom_type ELSE 'PLAIN'::opa_loom_type END, 'IDLE'::opa_loom_status, TRUE, CASE WHEN g <= 36 THEN 'Shed A' ELSE 'Shed B' END, 'Production', 'Toyota', CASE WHEN g <= 36 THEN 'JAT810-D' ELSE 'JAT810' END, 1200 FROM generate_series(1, 72) AS g ON CONFLICT (loom_number) DO NOTHING;
CREATE OR REPLACE VIEW opa_loom_master AS SELECT id AS loom_id, loom_number, loom_code, loom_type, make, model, serial_number, installation_date, width, rpm, production_capacity, location, department, operator_name, current_operator_id, current_shift_id, status, is_active AS active, created_at, updated_at FROM opa_looms;
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
CREATE INDEX IF NOT EXISTS idx_opa_production_entries_shift_code ON opa_production_entries (shift_code);
ALTER TABLE opa_company_settings ADD COLUMN IF NOT EXISTS allow_negative_stock BOOLEAN NOT NULL DEFAULT FALSE;
CREATE OR REPLACE FUNCTION opa_prevent_negative_stock() RETURNS TRIGGER LANGUAGE plpgsql AS $$
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
CREATE TRIGGER trg_opa_inventory_items_no_neg BEFORE INSERT OR UPDATE OF current_qty ON opa_inventory_items FOR EACH ROW EXECUTE FUNCTION opa_prevent_negative_stock();
DROP TRIGGER IF EXISTS trg_opa_yarn_master_no_neg ON opa_yarn_master;
CREATE TRIGGER trg_opa_yarn_master_no_neg BEFORE INSERT OR UPDATE OF current_qty ON opa_yarn_master FOR EACH ROW EXECUTE FUNCTION opa_prevent_negative_stock();
DROP TRIGGER IF EXISTS trg_opa_spare_parts_no_neg ON opa_spare_parts;
CREATE TRIGGER trg_opa_spare_parts_no_neg BEFORE INSERT OR UPDATE OF current_qty ON opa_spare_parts FOR EACH ROW EXECUTE FUNCTION opa_prevent_negative_stock();
CREATE INDEX IF NOT EXISTS idx_opa_inventory_items_status ON opa_inventory_items (is_active);
CREATE INDEX IF NOT EXISTS idx_opa_suppliers_status ON opa_suppliers (is_active);
CREATE INDEX IF NOT EXISTS idx_opa_purchase_orders_status ON opa_purchase_orders (status);
CREATE INDEX IF NOT EXISTS idx_opa_grns_status ON opa_grns (status);
CREATE INDEX IF NOT EXISTS idx_opa_maintenance_requests_status ON opa_maintenance_requests (status);
