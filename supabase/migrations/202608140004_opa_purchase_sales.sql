-- =============================================================================
-- OPA Group of India – Air Jet Loom ERP
-- Migration 004: Purchase & Sales (suppliers, PRs, RFQs, POs, GRNs,
-- customers, SOs, dispatches, payments, receipts, costing)
-- =============================================================================

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

-- ---------------------------------------------------------------------------
-- Suppliers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_code TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  mobile TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  gstin TEXT,
  pan TEXT,
  payment_terms TEXT,
  credit_limit NUMERIC(14, 2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_suppliers_code_unique UNIQUE (supplier_code)
);

CREATE INDEX IF NOT EXISTS idx_opa_suppliers_active ON opa_suppliers (is_active);
CREATE INDEX IF NOT EXISTS idx_opa_suppliers_name ON opa_suppliers (name);

DROP TRIGGER IF EXISTS trg_opa_suppliers_updated_at ON opa_suppliers;
CREATE TRIGGER trg_opa_suppliers_updated_at
  BEFORE UPDATE ON opa_suppliers
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_supplier_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES opa_suppliers (id) ON DELETE CASCADE,
  txn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  txn_type TEXT NOT NULL, -- INVOICE | PAYMENT | CREDIT_NOTE | DEBIT_NOTE | ADJUSTMENT
  reference_module TEXT,
  reference_id UUID,
  debit NUMERIC(14, 2) NOT NULL DEFAULT 0,
  credit NUMERIC(14, 2) NOT NULL DEFAULT 0,
  balance NUMERIC(14, 2),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_supplier_transactions_supplier ON opa_supplier_transactions (supplier_id, txn_date);

DROP TRIGGER IF EXISTS trg_opa_supplier_transactions_updated_at ON opa_supplier_transactions;
CREATE TRIGGER trg_opa_supplier_transactions_updated_at
  BEFORE UPDATE ON opa_supplier_transactions
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE OR REPLACE VIEW opa_supplier_ledger AS
SELECT
  st.id,
  st.supplier_id,
  s.supplier_code,
  s.name AS supplier_name,
  st.txn_date,
  st.txn_type,
  st.reference_module,
  st.reference_id,
  st.debit,
  st.credit,
  SUM(st.debit - st.credit) OVER (
    PARTITION BY st.supplier_id
    ORDER BY st.txn_date, st.created_at, st.id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS running_balance,
  st.remarks,
  st.created_at
FROM opa_supplier_transactions st
JOIN opa_suppliers s ON s.id = st.supplier_id;

-- ---------------------------------------------------------------------------
-- Purchase requisitions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_purchase_requisitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_number TEXT NOT NULL,
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  department_id UUID REFERENCES opa_departments (id) ON DELETE SET NULL,
  requested_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  required_by DATE,
  status opa_doc_status NOT NULL DEFAULT 'DRAFT',
  priority TEXT DEFAULT 'NORMAL',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_purchase_requisitions_number_unique UNIQUE (pr_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_prs_status ON opa_purchase_requisitions (status);
CREATE INDEX IF NOT EXISTS idx_opa_prs_date ON opa_purchase_requisitions (request_date);

DROP TRIGGER IF EXISTS trg_opa_purchase_requisitions_updated_at ON opa_purchase_requisitions;
CREATE TRIGGER trg_opa_purchase_requisitions_updated_at
  BEFORE UPDATE ON opa_purchase_requisitions
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_purchase_requisition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pr_id UUID NOT NULL REFERENCES opa_purchase_requisitions (id) ON DELETE CASCADE,
  item_id UUID REFERENCES opa_inventory_items (id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL,
  uom TEXT NOT NULL DEFAULT 'PCS',
  estimated_rate NUMERIC(14, 4) DEFAULT 0,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_pr_items_pr ON opa_purchase_requisition_items (pr_id);

DROP TRIGGER IF EXISTS trg_opa_purchase_requisition_items_updated_at ON opa_purchase_requisition_items;
CREATE TRIGGER trg_opa_purchase_requisition_items_updated_at
  BEFORE UPDATE ON opa_purchase_requisition_items
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- RFQs & supplier quotations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_rfqs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rfq_number TEXT NOT NULL,
  pr_id UUID REFERENCES opa_purchase_requisitions (id) ON DELETE SET NULL,
  rfq_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  status opa_doc_status NOT NULL DEFAULT 'DRAFT',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_rfqs_number_unique UNIQUE (rfq_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_rfqs_status ON opa_rfqs (status);

DROP TRIGGER IF EXISTS trg_opa_rfqs_updated_at ON opa_rfqs;
CREATE TRIGGER trg_opa_rfqs_updated_at
  BEFORE UPDATE ON opa_rfqs
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_supplier_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_number TEXT NOT NULL,
  rfq_id UUID REFERENCES opa_rfqs (id) ON DELETE SET NULL,
  supplier_id UUID NOT NULL REFERENCES opa_suppliers (id) ON DELETE RESTRICT,
  quotation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  currency TEXT NOT NULL DEFAULT 'INR',
  total_amount NUMERIC(14, 2) DEFAULT 0,
  status opa_doc_status NOT NULL DEFAULT 'DRAFT',
  is_selected BOOLEAN NOT NULL DEFAULT FALSE,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_supplier_quotations_number_unique UNIQUE (quotation_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_supplier_quotations_rfq ON opa_supplier_quotations (rfq_id);
CREATE INDEX IF NOT EXISTS idx_opa_supplier_quotations_supplier ON opa_supplier_quotations (supplier_id);

DROP TRIGGER IF EXISTS trg_opa_supplier_quotations_updated_at ON opa_supplier_quotations;
CREATE TRIGGER trg_opa_supplier_quotations_updated_at
  BEFORE UPDATE ON opa_supplier_quotations
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES opa_supplier_quotations (id) ON DELETE CASCADE,
  item_id UUID REFERENCES opa_inventory_items (id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL,
  uom TEXT NOT NULL DEFAULT 'PCS',
  rate NUMERIC(14, 4) NOT NULL DEFAULT 0,
  amount NUMERIC(14, 2) GENERATED ALWAYS AS (ROUND(quantity * rate, 2)) STORED,
  lead_time_days INTEGER,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_quotation_items_quotation ON opa_quotation_items (quotation_id);

DROP TRIGGER IF EXISTS trg_opa_quotation_items_updated_at ON opa_quotation_items;
CREATE TRIGGER trg_opa_quotation_items_updated_at
  BEFORE UPDATE ON opa_quotation_items
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Purchase orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES opa_suppliers (id) ON DELETE RESTRICT,
  quotation_id UUID REFERENCES opa_supplier_quotations (id) ON DELETE SET NULL,
  pr_id UUID REFERENCES opa_purchase_requisitions (id) ON DELETE SET NULL,
  po_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_delivery DATE,
  currency TEXT NOT NULL DEFAULT 'INR',
  subtotal NUMERIC(14, 2) DEFAULT 0,
  tax_amount NUMERIC(14, 2) DEFAULT 0,
  total_amount NUMERIC(14, 2) DEFAULT 0,
  status opa_doc_status NOT NULL DEFAULT 'DRAFT',
  payment_status opa_payment_status NOT NULL DEFAULT 'PENDING',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_purchase_orders_number_unique UNIQUE (po_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_pos_supplier ON opa_purchase_orders (supplier_id);
CREATE INDEX IF NOT EXISTS idx_opa_pos_status ON opa_purchase_orders (status);
CREATE INDEX IF NOT EXISTS idx_opa_pos_date ON opa_purchase_orders (po_date);

DROP TRIGGER IF EXISTS trg_opa_purchase_orders_updated_at ON opa_purchase_orders;
CREATE TRIGGER trg_opa_purchase_orders_updated_at
  BEFORE UPDATE ON opa_purchase_orders
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES opa_purchase_orders (id) ON DELETE CASCADE,
  item_id UUID REFERENCES opa_inventory_items (id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL,
  received_qty NUMERIC(14, 3) NOT NULL DEFAULT 0,
  uom TEXT NOT NULL DEFAULT 'PCS',
  rate NUMERIC(14, 4) NOT NULL DEFAULT 0,
  tax_pct NUMERIC(5, 2) DEFAULT 0,
  amount NUMERIC(14, 2) GENERATED ALWAYS AS (ROUND(quantity * rate, 2)) STORED,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_po_items_po ON opa_purchase_order_items (po_id);

DROP TRIGGER IF EXISTS trg_opa_purchase_order_items_updated_at ON opa_purchase_order_items;
CREATE TRIGGER trg_opa_purchase_order_items_updated_at
  BEFORE UPDATE ON opa_purchase_order_items
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- GRNs
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_grns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number TEXT NOT NULL,
  po_id UUID REFERENCES opa_purchase_orders (id) ON DELETE SET NULL,
  supplier_id UUID REFERENCES opa_suppliers (id) ON DELETE SET NULL,
  store_id UUID REFERENCES opa_stores (id) ON DELETE SET NULL,
  grn_date DATE NOT NULL DEFAULT CURRENT_DATE,
  invoice_number TEXT,
  invoice_date DATE,
  status opa_doc_status NOT NULL DEFAULT 'DRAFT',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_grns_number_unique UNIQUE (grn_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_grns_po ON opa_grns (po_id);
CREATE INDEX IF NOT EXISTS idx_opa_grns_date ON opa_grns (grn_date);

DROP TRIGGER IF EXISTS trg_opa_grns_updated_at ON opa_grns;
CREATE TRIGGER trg_opa_grns_updated_at
  BEFORE UPDATE ON opa_grns
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_grn_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id UUID NOT NULL REFERENCES opa_grns (id) ON DELETE CASCADE,
  po_item_id UUID REFERENCES opa_purchase_order_items (id) ON DELETE SET NULL,
  item_id UUID REFERENCES opa_inventory_items (id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  ordered_qty NUMERIC(14, 3) DEFAULT 0,
  received_qty NUMERIC(14, 3) NOT NULL,
  accepted_qty NUMERIC(14, 3),
  rejected_qty NUMERIC(14, 3) DEFAULT 0,
  uom TEXT NOT NULL DEFAULT 'PCS',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_grn_items_grn ON opa_grn_items (grn_id);

DROP TRIGGER IF EXISTS trg_opa_grn_items_updated_at ON opa_grn_items;
CREATE TRIGGER trg_opa_grn_items_updated_at
  BEFORE UPDATE ON opa_grn_items
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code TEXT NOT NULL,
  name TEXT NOT NULL,
  contact_person TEXT,
  email TEXT,
  mobile TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  gstin TEXT,
  pan TEXT,
  payment_terms TEXT,
  credit_limit NUMERIC(14, 2) DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_customers_code_unique UNIQUE (customer_code)
);

CREATE INDEX IF NOT EXISTS idx_opa_customers_active ON opa_customers (is_active);
CREATE INDEX IF NOT EXISTS idx_opa_customers_name ON opa_customers (name);

DROP TRIGGER IF EXISTS trg_opa_customers_updated_at ON opa_customers;
CREATE TRIGGER trg_opa_customers_updated_at
  BEFORE UPDATE ON opa_customers
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Sales orders
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_sales_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES opa_customers (id) ON DELETE RESTRICT,
  so_date DATE NOT NULL DEFAULT CURRENT_DATE,
  delivery_date DATE,
  currency TEXT NOT NULL DEFAULT 'INR',
  subtotal NUMERIC(14, 2) DEFAULT 0,
  tax_amount NUMERIC(14, 2) DEFAULT 0,
  total_amount NUMERIC(14, 2) DEFAULT 0,
  status opa_doc_status NOT NULL DEFAULT 'DRAFT',
  payment_status opa_payment_status NOT NULL DEFAULT 'PENDING',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_sales_orders_number_unique UNIQUE (so_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_sos_customer ON opa_sales_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_opa_sos_status ON opa_sales_orders (status);
CREATE INDEX IF NOT EXISTS idx_opa_sos_date ON opa_sales_orders (so_date);

DROP TRIGGER IF EXISTS trg_opa_sales_orders_updated_at ON opa_sales_orders;
CREATE TRIGGER trg_opa_sales_orders_updated_at
  BEFORE UPDATE ON opa_sales_orders
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_sales_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  so_id UUID NOT NULL REFERENCES opa_sales_orders (id) ON DELETE CASCADE,
  article_id UUID REFERENCES opa_articles (id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL,
  dispatched_qty NUMERIC(14, 3) NOT NULL DEFAULT 0,
  uom TEXT NOT NULL DEFAULT 'MTR',
  rate NUMERIC(14, 4) NOT NULL DEFAULT 0,
  amount NUMERIC(14, 2) GENERATED ALWAYS AS (ROUND(quantity * rate, 2)) STORED,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_so_items_so ON opa_sales_order_items (so_id);

DROP TRIGGER IF EXISTS trg_opa_sales_order_items_updated_at ON opa_sales_order_items;
CREATE TRIGGER trg_opa_sales_order_items_updated_at
  BEFORE UPDATE ON opa_sales_order_items
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Dispatches
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_number TEXT NOT NULL,
  so_id UUID REFERENCES opa_sales_orders (id) ON DELETE SET NULL,
  customer_id UUID REFERENCES opa_customers (id) ON DELETE SET NULL,
  dispatch_date DATE NOT NULL DEFAULT CURRENT_DATE,
  vehicle_number TEXT,
  transporter TEXT,
  lr_number TEXT,
  status opa_doc_status NOT NULL DEFAULT 'DRAFT',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_dispatches_number_unique UNIQUE (dispatch_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_dispatches_so ON opa_dispatches (so_id);
CREATE INDEX IF NOT EXISTS idx_opa_dispatches_date ON opa_dispatches (dispatch_date);

DROP TRIGGER IF EXISTS trg_opa_dispatches_updated_at ON opa_dispatches;
CREATE TRIGGER trg_opa_dispatches_updated_at
  BEFORE UPDATE ON opa_dispatches
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_dispatch_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES opa_dispatches (id) ON DELETE CASCADE,
  so_item_id UUID REFERENCES opa_sales_order_items (id) ON DELETE SET NULL,
  greige_id UUID REFERENCES opa_greige_stock (id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  quantity NUMERIC(14, 3) NOT NULL,
  uom TEXT NOT NULL DEFAULT 'MTR',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_dispatch_items_dispatch ON opa_dispatch_items (dispatch_id);

DROP TRIGGER IF EXISTS trg_opa_dispatch_items_updated_at ON opa_dispatch_items;
CREATE TRIGGER trg_opa_dispatch_items_updated_at
  BEFORE UPDATE ON opa_dispatch_items
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Payments (to suppliers) & receipts (from customers)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_number TEXT NOT NULL,
  supplier_id UUID NOT NULL REFERENCES opa_suppliers (id) ON DELETE RESTRICT,
  po_id UUID REFERENCES opa_purchase_orders (id) ON DELETE SET NULL,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14, 2) NOT NULL,
  mode opa_payment_mode NOT NULL DEFAULT 'NEFT',
  reference_no TEXT,
  status opa_payment_status NOT NULL DEFAULT 'PENDING',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_payments_number_unique UNIQUE (payment_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_payments_supplier ON opa_payments (supplier_id);
CREATE INDEX IF NOT EXISTS idx_opa_payments_date ON opa_payments (payment_date);

DROP TRIGGER IF EXISTS trg_opa_payments_updated_at ON opa_payments;
CREATE TRIGGER trg_opa_payments_updated_at
  BEFORE UPDATE ON opa_payments
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL,
  customer_id UUID NOT NULL REFERENCES opa_customers (id) ON DELETE RESTRICT,
  so_id UUID REFERENCES opa_sales_orders (id) ON DELETE SET NULL,
  receipt_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14, 2) NOT NULL,
  mode opa_payment_mode NOT NULL DEFAULT 'NEFT',
  reference_no TEXT,
  status opa_payment_status NOT NULL DEFAULT 'PENDING',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_receipts_number_unique UNIQUE (receipt_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_receipts_customer ON opa_receipts (customer_id);
CREATE INDEX IF NOT EXISTS idx_opa_receipts_date ON opa_receipts (receipt_date);

DROP TRIGGER IF EXISTS trg_opa_receipts_updated_at ON opa_receipts;
CREATE TRIGGER trg_opa_receipts_updated_at
  BEFORE UPDATE ON opa_receipts
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Costing entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_costing_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  costing_number TEXT NOT NULL,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  article_id UUID REFERENCES opa_articles (id) ON DELETE SET NULL,
  loom_id UUID REFERENCES opa_looms (id) ON DELETE SET NULL,
  production_entry_id UUID REFERENCES opa_production_entries (id) ON DELETE SET NULL,
  yarn_cost NUMERIC(14, 2) DEFAULT 0,
  labour_cost NUMERIC(14, 2) DEFAULT 0,
  power_cost NUMERIC(14, 2) DEFAULT 0,
  overhead_cost NUMERIC(14, 2) DEFAULT 0,
  maintenance_cost NUMERIC(14, 2) DEFAULT 0,
  other_cost NUMERIC(14, 2) DEFAULT 0,
  total_cost NUMERIC(14, 2) GENERATED ALWAYS AS (
    COALESCE(yarn_cost, 0) + COALESCE(labour_cost, 0) + COALESCE(power_cost, 0)
    + COALESCE(overhead_cost, 0) + COALESCE(maintenance_cost, 0) + COALESCE(other_cost, 0)
  ) STORED,
  meters NUMERIC(14, 3) DEFAULT 0,
  cost_per_meter NUMERIC(14, 4),
  formula_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_costing_entries_number_unique UNIQUE (costing_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_costing_entries_date ON opa_costing_entries (entry_date);
CREATE INDEX IF NOT EXISTS idx_opa_costing_entries_article ON opa_costing_entries (article_id);

DROP TRIGGER IF EXISTS trg_opa_costing_entries_updated_at ON opa_costing_entries;
CREATE TRIGGER trg_opa_costing_entries_updated_at
  BEFORE UPDATE ON opa_costing_entries
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

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
