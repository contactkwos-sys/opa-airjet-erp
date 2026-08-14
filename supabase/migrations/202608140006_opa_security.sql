-- =============================================================================
-- OPA Group of India – Air Jet Loom ERP
-- Migration 006: Security (visitors, CEO visits, gate passes, checkins,
-- vehicles, material gate, incidents, WhatsApp outbox/webhooks)
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_ceo_visit_status') THEN
    CREATE TYPE opa_ceo_visit_status AS ENUM (
      'PENDING',
      'APPROVED',
      'REJECTED',
      'RESCHEDULED',
      'COMPLETED'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_gate_pass_type') THEN
    CREATE TYPE opa_gate_pass_type AS ENUM (
      'VISITOR',
      'EMPLOYEE',
      'MATERIAL',
      'VEHICLE',
      'OTHER'
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'opa_material_direction') THEN
    CREATE TYPE opa_material_direction AS ENUM ('INWARD', 'OUTWARD');
  END IF;
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

-- ---------------------------------------------------------------------------
-- Visitors
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  company TEXT,
  id_proof_type TEXT,
  id_proof_number TEXT,
  photo_url TEXT,
  is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_visitors_code_unique UNIQUE (visitor_code)
);

CREATE INDEX IF NOT EXISTS idx_opa_visitors_mobile ON opa_visitors (mobile);
CREATE INDEX IF NOT EXISTS idx_opa_visitors_name ON opa_visitors (full_name);

DROP TRIGGER IF EXISTS trg_opa_visitors_updated_at ON opa_visitors;
CREATE TRIGGER trg_opa_visitors_updated_at
  BEFORE UPDATE ON opa_visitors
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- CEO visit requests (WhatsApp approval workflow)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_ceo_visit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL,
  visitor_id UUID REFERENCES opa_visitors (id) ON DELETE SET NULL,
  visitor_name TEXT NOT NULL,
  visitor_mobile TEXT,
  visitor_company TEXT,
  purpose TEXT NOT NULL,
  host_employee_id UUID REFERENCES opa_employees (id) ON DELETE SET NULL,
  host_name TEXT,
  requested_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  proposed_visit_at TIMESTAMPTZ,
  proposed_times JSONB NOT NULL DEFAULT '[]'::jsonb,
  status opa_ceo_visit_status NOT NULL DEFAULT 'PENDING',
  whatsapp_message_id TEXT,
  ceo_response_at TIMESTAMPTZ,
  ceo_notes TEXT,
  approved_visit_at TIMESTAMPTZ,
  action_token TEXT,
  action_token_expires_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_ceo_visit_requests_number_unique UNIQUE (request_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_ceo_visit_status ON opa_ceo_visit_requests (status);
CREATE INDEX IF NOT EXISTS idx_opa_ceo_visit_requested ON opa_ceo_visit_requests (requested_at DESC);
CREATE INDEX IF NOT EXISTS idx_opa_ceo_visit_token ON opa_ceo_visit_requests (action_token)
  WHERE action_token IS NOT NULL;

DROP TRIGGER IF EXISTS trg_opa_ceo_visit_requests_updated_at ON opa_ceo_visit_requests;
CREATE TRIGGER trg_opa_ceo_visit_requests_updated_at
  BEFORE UPDATE ON opa_ceo_visit_requests
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Gate passes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_gate_passes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pass_number TEXT NOT NULL,
  pass_type opa_gate_pass_type NOT NULL DEFAULT 'VISITOR',
  visitor_id UUID REFERENCES opa_visitors (id) ON DELETE SET NULL,
  employee_id UUID REFERENCES opa_employees (id) ON DELETE SET NULL,
  ceo_visit_request_id UUID REFERENCES opa_ceo_visit_requests (id) ON DELETE SET NULL,
  valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  purpose TEXT,
  issued_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_gate_passes_number_unique UNIQUE (pass_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_gate_passes_status ON opa_gate_passes (status);
CREATE INDEX IF NOT EXISTS idx_opa_gate_passes_visitor ON opa_gate_passes (visitor_id);

DROP TRIGGER IF EXISTS trg_opa_gate_passes_updated_at ON opa_gate_passes;
CREATE TRIGGER trg_opa_gate_passes_updated_at
  BEFORE UPDATE ON opa_gate_passes
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Visitor check-ins
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_visitor_checkins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id UUID NOT NULL REFERENCES opa_visitors (id) ON DELETE CASCADE,
  gate_pass_id UUID REFERENCES opa_gate_passes (id) ON DELETE SET NULL,
  ceo_visit_request_id UUID REFERENCES opa_ceo_visit_requests (id) ON DELETE SET NULL,
  check_in_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  check_out_at TIMESTAMPTZ,
  checked_in_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  checked_out_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  badge_number TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_visitor_checkins_visitor ON opa_visitor_checkins (visitor_id);
CREATE INDEX IF NOT EXISTS idx_opa_visitor_checkins_in ON opa_visitor_checkins (check_in_at DESC);

DROP TRIGGER IF EXISTS trg_opa_visitor_checkins_updated_at ON opa_visitor_checkins;
CREATE TRIGGER trg_opa_visitor_checkins_updated_at
  BEFORE UPDATE ON opa_visitor_checkins
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Vehicle entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_vehicle_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number TEXT NOT NULL,
  vehicle_number TEXT NOT NULL,
  vehicle_type TEXT,
  driver_name TEXT,
  driver_mobile TEXT,
  purpose TEXT,
  direction opa_material_direction NOT NULL DEFAULT 'INWARD',
  entry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  exit_at TIMESTAMPTZ,
  gate_pass_id UUID REFERENCES opa_gate_passes (id) ON DELETE SET NULL,
  recorded_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_vehicle_entries_number_unique UNIQUE (entry_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_vehicle_entries_vehicle ON opa_vehicle_entries (vehicle_number);
CREATE INDEX IF NOT EXISTS idx_opa_vehicle_entries_at ON opa_vehicle_entries (entry_at DESC);

DROP TRIGGER IF EXISTS trg_opa_vehicle_entries_updated_at ON opa_vehicle_entries;
CREATE TRIGGER trg_opa_vehicle_entries_updated_at
  BEFORE UPDATE ON opa_vehicle_entries
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Material gate entries
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_material_gate_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number TEXT NOT NULL,
  direction opa_material_direction NOT NULL,
  material_description TEXT NOT NULL,
  quantity NUMERIC(14, 3),
  uom TEXT,
  vehicle_number TEXT,
  supplier_id UUID REFERENCES opa_suppliers (id) ON DELETE SET NULL,
  customer_id UUID REFERENCES opa_customers (id) ON DELETE SET NULL,
  reference_module TEXT,
  reference_id UUID,
  gate_pass_id UUID REFERENCES opa_gate_passes (id) ON DELETE SET NULL,
  entry_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_material_gate_entries_number_unique UNIQUE (entry_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_material_gate_direction ON opa_material_gate_entries (direction);
CREATE INDEX IF NOT EXISTS idx_opa_material_gate_at ON opa_material_gate_entries (entry_at DESC);

DROP TRIGGER IF EXISTS trg_opa_material_gate_entries_updated_at ON opa_material_gate_entries;
CREATE TRIGGER trg_opa_material_gate_entries_updated_at
  BEFORE UPDATE ON opa_material_gate_entries
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- Security incidents
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number TEXT NOT NULL,
  incident_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  location TEXT,
  severity opa_alert_severity NOT NULL DEFAULT 'MEDIUM',
  title TEXT NOT NULL,
  description TEXT,
  reported_by UUID REFERENCES opa_profiles (id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'OPEN',
  resolution TEXT,
  resolved_at TIMESTAMPTZ,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT opa_security_incidents_number_unique UNIQUE (incident_number)
);

CREATE INDEX IF NOT EXISTS idx_opa_security_incidents_status ON opa_security_incidents (status);
CREATE INDEX IF NOT EXISTS idx_opa_security_incidents_at ON opa_security_incidents (incident_at DESC);

DROP TRIGGER IF EXISTS trg_opa_security_incidents_updated_at ON opa_security_incidents;
CREATE TRIGGER trg_opa_security_incidents_updated_at
  BEFORE UPDATE ON opa_security_incidents
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

-- ---------------------------------------------------------------------------
-- WhatsApp architecture
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opa_whatsapp_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to_number TEXT NOT NULL,
  template_name TEXT,
  message_body TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status opa_whatsapp_status NOT NULL DEFAULT 'QUEUED',
  provider_message_id TEXT,
  related_module TEXT,
  related_record_id UUID,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_whatsapp_outbox_status ON opa_whatsapp_outbox (status);
CREATE INDEX IF NOT EXISTS idx_opa_whatsapp_outbox_related ON opa_whatsapp_outbox (related_module, related_record_id);

DROP TRIGGER IF EXISTS trg_opa_whatsapp_outbox_updated_at ON opa_whatsapp_outbox;
CREATE TRIGGER trg_opa_whatsapp_outbox_updated_at
  BEFORE UPDATE ON opa_whatsapp_outbox
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_whatsapp_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT,
  provider_message_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opa_whatsapp_webhooks_processed ON opa_whatsapp_webhooks (processed);
CREATE INDEX IF NOT EXISTS idx_opa_whatsapp_webhooks_provider ON opa_whatsapp_webhooks (provider_message_id);

DROP TRIGGER IF EXISTS trg_opa_whatsapp_webhooks_updated_at ON opa_whatsapp_webhooks;
CREATE TRIGGER trg_opa_whatsapp_webhooks_updated_at
  BEFORE UPDATE ON opa_whatsapp_webhooks
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

ALTER TABLE opa_visitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_ceo_visit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_gate_passes ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_visitor_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_vehicle_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_material_gate_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_whatsapp_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE opa_whatsapp_webhooks ENABLE ROW LEVEL SECURITY;
