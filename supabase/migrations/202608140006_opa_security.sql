-- =============================================================================
-- OPA Group of India – Air Jet Loom ERP
-- Migration 006: Security integration notes + WhatsApp outbox helpers
--
-- IMPORTANT: Do NOT duplicate Security / Visitor / CEO tables.
-- The production Security module owns:
--   visitor_requests, ceo_visit_requests, visitor_entries,
--   security_incidents, vehicle_entries, material_gate_entries,
--   security_notifications, security_audit_logs
-- ERP auth/roles live in opa_profiles (not shared CRM public.profiles).
-- See: 20260814000000_security_visitor_module.sql
-- =============================================================================

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

-- Optional WhatsApp outbox for ERP-side retries (Edge Functions remain source of truth)
CREATE TABLE IF NOT EXISTS opa_whatsapp_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  to_number TEXT NOT NULL,
  template_name TEXT,
  body TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  status opa_whatsapp_status NOT NULL DEFAULT 'QUEUED',
  provider_message_id TEXT,
  error_message TEXT,
  related_module TEXT,
  related_record_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID,
  updated_by UUID
);

CREATE INDEX IF NOT EXISTS idx_opa_whatsapp_outbox_status
  ON opa_whatsapp_outbox (status, scheduled_at);

DROP TRIGGER IF EXISTS trg_opa_whatsapp_outbox_updated_at ON opa_whatsapp_outbox;
CREATE TRIGGER trg_opa_whatsapp_outbox_updated_at
  BEFORE UPDATE ON opa_whatsapp_outbox
  FOR EACH ROW EXECUTE FUNCTION opa_set_updated_at();

CREATE TABLE IF NOT EXISTS opa_whatsapp_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL DEFAULT 'meta',
  event_type TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_opa_whatsapp_webhooks_processed
  ON opa_whatsapp_webhooks (processed, created_at DESC);

COMMENT ON TABLE opa_whatsapp_outbox IS
  'ERP WhatsApp outbox. Visitor/CEO flows use ceo_visit_requests + Edge Functions from Security module.';
