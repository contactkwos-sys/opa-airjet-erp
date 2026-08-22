-- =============================================================================
-- OPA Group of India — Security + Visitor Management Module
-- Non-destructive / coexistence-safe for shared Supabase projects.
--
-- DOES:
--   • Create Security tables with UUID PKs, indexes, and role-based RLS
--   • Prefer opa_profiles for role checks (created in later opa_* migrations)
--
-- DOES NOT:
--   • DROP or ALTER existing CRM/KWOS/family tables or data
--   • Recreate public.profiles or public.audit_logs (already used by other apps)
--   • Replace auth.users triggers / handle_new_user belonging to other apps
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Role helpers (plpgsql so opa_profiles may be created in a later migration)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.opa_security_current_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r TEXT;
BEGIN
  BEGIN
    SELECT role::text
      INTO r
      FROM opa_profiles
     WHERE id = auth.uid()
       AND is_active = TRUE
     LIMIT 1;
  EXCEPTION
    WHEN undefined_table THEN
      r := NULL;
    WHEN undefined_column THEN
      r := NULL;
  END;

  IF r IS NOT NULL AND length(trim(r)) > 0 THEN
    RETURN r;
  END IF;

  RETURN '';
END;
$$;

CREATE OR REPLACE FUNCTION public.opa_is_security_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.opa_security_current_role() IN (
    'SUPER_ADMIN','SECURITY_HEAD','SECURITY_GUARD'
  );
$$;

CREATE OR REPLACE FUNCTION public.opa_is_ceo_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.opa_security_current_role() IN (
    'SUPER_ADMIN','CEO','DIRECTOR'
  );
$$;

GRANT EXECUTE ON FUNCTION public.opa_security_current_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.opa_is_security_staff() TO authenticated;
GRANT EXECUTE ON FUNCTION public.opa_is_ceo_or_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- Security domain tables (dedicated names — no clash with CRM audit_logs)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.visitor_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_number TEXT NOT NULL UNIQUE,
  visitor_name TEXT NOT NULL,
  company_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT,
  purpose TEXT NOT NULL,
  person_to_meet TEXT NOT NULL,
  department TEXT,
  requested_date DATE NOT NULL,
  requested_time TIME NOT NULL,
  number_of_visitors INTEGER NOT NULL DEFAULT 1 CHECK (number_of_visitors BETWEEN 1 AND 50),
  vehicle_number TEXT,
  vehicle_type TEXT,
  id_proof_type TEXT,
  id_proof_number TEXT,
  visitor_photo_url TEXT,
  security_remarks TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN (
      'PENDING','PENDING_CEO_APPROVAL','APPROVED','REJECTED','RESCHEDULED',
      'CHECKED_IN','EXITED','CANCELLED','COMPLETED'
    )),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS visitor_requests_active_mobile_date_idx
  ON public.visitor_requests (mobile, requested_date)
  WHERE status NOT IN ('CANCELLED','REJECTED','EXITED','COMPLETED');

CREATE INDEX IF NOT EXISTS idx_visitor_requests_status_date
  ON public.visitor_requests (status, requested_date DESC);

CREATE TABLE IF NOT EXISTS public.ceo_visit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_request_id UUID NOT NULL REFERENCES public.visitor_requests(id) ON DELETE CASCADE,
  request_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_CEO_APPROVAL',
  ceo_decision TEXT CHECK (ceo_decision IN ('APPROVED','REJECTED','RESCHEDULED')),
  ceo_remarks TEXT,
  decision_by UUID,
  decision_at TIMESTAMPTZ,
  rescheduled_date DATE,
  rescheduled_time TIME,
  approval_token_hash TEXT,
  token_expires_at TIMESTAMPTZ,
  whatsapp_status TEXT CHECK (whatsapp_status IN (
    'PENDING_CONFIGURATION','SENT','FAILED','SKIPPED'
  )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ceo_visit_requests_visitor
  ON public.ceo_visit_requests (visitor_request_id);

CREATE INDEX IF NOT EXISTS idx_ceo_visit_requests_token_hash
  ON public.ceo_visit_requests (approval_token_hash)
  WHERE approval_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.visitor_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_request_id UUID NOT NULL REFERENCES public.visitor_requests(id),
  gate_pass_number TEXT NOT NULL UNIQUE,
  actual_arrival_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_in_by UUID,
  visitor_photo_url TEXT,
  id_verified BOOLEAN NOT NULL DEFAULT false,
  actual_vehicle_number TEXT,
  number_of_persons INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'INSIDE' CHECK (status IN ('INSIDE','EXITED')),
  exit_time TIMESTAMPTZ,
  check_out_by UUID,
  visit_duration TEXT,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS visitor_entries_one_inside_idx
  ON public.visitor_entries (visitor_request_id)
  WHERE status = 'INSIDE';

CREATE TABLE IF NOT EXISTS public.security_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_number TEXT NOT NULL UNIQUE,
  incident_date DATE NOT NULL,
  incident_time TIME NOT NULL,
  location TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  description TEXT NOT NULL,
  person_involved TEXT,
  security_officer TEXT,
  severity TEXT NOT NULL CHECK (severity IN ('LOW','MEDIUM','HIGH','CRITICAL')),
  action_taken TEXT,
  photo_url TEXT,
  attachment_url TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','IN_PROGRESS','CLOSED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_incidents_status_date
  ON public.security_incidents (status, incident_date DESC);

CREATE TABLE IF NOT EXISTS public.vehicle_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_number TEXT NOT NULL,
  driver_name TEXT NOT NULL,
  mobile TEXT,
  company TEXT,
  purpose TEXT,
  material TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('IN','OUT')),
  entry_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_time TIMESTAMPTZ,
  gate_pass_number TEXT,
  security_officer TEXT,
  status TEXT NOT NULL DEFAULT 'INSIDE' CHECK (status IN ('INSIDE','EXITED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_entries_status_time
  ON public.vehicle_entries (status, entry_time DESC);

CREATE TABLE IF NOT EXISTS public.material_gate_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('INWARD','OUTWARD')),
  supplier_or_department TEXT NOT NULL,
  po_number TEXT,
  invoice_number TEXT,
  challan_number TEXT,
  vehicle_number TEXT,
  material TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  unit TEXT NOT NULL DEFAULT 'NOS',
  purpose TEXT,
  approved_by TEXT,
  security_verified_by TEXT,
  entry_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  exit_time TIMESTAMPTZ,
  document_url TEXT,
  photo_url TEXT,
  status TEXT NOT NULL DEFAULT 'VERIFIED'
    CHECK (status IN ('PENDING','VERIFIED','REJECTED','COMPLETED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT material_outward_requires_approval CHECK (
    entry_type <> 'OUTWARD' OR (approved_by IS NOT NULL AND length(trim(approved_by)) > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_material_gate_entries_type_time
  ON public.material_gate_entries (entry_type, entry_time DESC);

CREATE TABLE IF NOT EXISTS public.security_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL,
  reference_id UUID,
  recipient_role TEXT,
  recipient_user_id UUID,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_notifications_recipient
  ON public.security_notifications (recipient_user_id, is_read, created_at DESC);

-- Dedicated Security audit table (does NOT touch existing public.audit_logs)
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_module
  ON public.security_audit_logs (module, created_at DESC);

-- ---------------------------------------------------------------------------
-- RLS — authenticated role-based; no public (anon) open policies
-- ---------------------------------------------------------------------------
ALTER TABLE public.visitor_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_visit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_gate_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

-- Revoke broad anon access if any default grants exist
REVOKE ALL ON TABLE public.visitor_requests FROM anon;
REVOKE ALL ON TABLE public.ceo_visit_requests FROM anon;
REVOKE ALL ON TABLE public.visitor_entries FROM anon;
REVOKE ALL ON TABLE public.security_incidents FROM anon;
REVOKE ALL ON TABLE public.vehicle_entries FROM anon;
REVOKE ALL ON TABLE public.material_gate_entries FROM anon;
REVOKE ALL ON TABLE public.security_notifications FROM anon;
REVOKE ALL ON TABLE public.security_audit_logs FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visitor_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ceo_visit_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.visitor_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.security_incidents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.vehicle_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.material_gate_entries TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.security_notifications TO authenticated;
GRANT SELECT, INSERT ON TABLE public.security_audit_logs TO authenticated;

DROP POLICY IF EXISTS visitor_requests_security_all ON public.visitor_requests;
CREATE POLICY visitor_requests_security_all ON public.visitor_requests
  FOR ALL TO authenticated
  USING (
    public.opa_is_security_staff()
    OR public.opa_security_current_role() = 'FACTORY_MANAGER'
    OR public.opa_is_ceo_or_admin()
  )
  WITH CHECK (
    public.opa_is_security_staff()
    OR public.opa_security_current_role() = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS ceo_requests_select ON public.ceo_visit_requests;
CREATE POLICY ceo_requests_select ON public.ceo_visit_requests
  FOR SELECT TO authenticated
  USING (public.opa_is_ceo_or_admin() OR public.opa_is_security_staff());

DROP POLICY IF EXISTS ceo_requests_insert ON public.ceo_visit_requests;
CREATE POLICY ceo_requests_insert ON public.ceo_visit_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    public.opa_is_security_staff()
    OR public.opa_security_current_role() = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS ceo_requests_update ON public.ceo_visit_requests;
CREATE POLICY ceo_requests_update ON public.ceo_visit_requests
  FOR UPDATE TO authenticated
  USING (
    public.opa_is_ceo_or_admin()
    OR public.opa_security_current_role() = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS visitor_entries_security ON public.visitor_entries;
CREATE POLICY visitor_entries_security ON public.visitor_entries
  FOR ALL TO authenticated
  USING (
    public.opa_is_security_staff()
    OR public.opa_security_current_role() IN ('SUPER_ADMIN','FACTORY_MANAGER')
  )
  WITH CHECK (
    public.opa_is_security_staff()
    OR public.opa_security_current_role() = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS incidents_security ON public.security_incidents;
CREATE POLICY incidents_security ON public.security_incidents
  FOR ALL TO authenticated
  USING (
    public.opa_is_security_staff()
    OR public.opa_security_current_role() IN ('SUPER_ADMIN','FACTORY_MANAGER')
  )
  WITH CHECK (
    public.opa_is_security_staff()
    OR public.opa_security_current_role() = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS vehicles_security ON public.vehicle_entries;
CREATE POLICY vehicles_security ON public.vehicle_entries
  FOR ALL TO authenticated
  USING (
    public.opa_is_security_staff()
    OR public.opa_security_current_role() IN ('SUPER_ADMIN','FACTORY_MANAGER')
  )
  WITH CHECK (
    public.opa_is_security_staff()
    OR public.opa_security_current_role() = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS material_security ON public.material_gate_entries;
CREATE POLICY material_security ON public.material_gate_entries
  FOR ALL TO authenticated
  USING (
    public.opa_is_security_staff()
    OR public.opa_security_current_role() IN ('SUPER_ADMIN','FACTORY_MANAGER')
  )
  WITH CHECK (
    public.opa_is_security_staff()
    OR public.opa_security_current_role() = 'SUPER_ADMIN'
  );

DROP POLICY IF EXISTS security_notifications_select ON public.security_notifications;
CREATE POLICY security_notifications_select ON public.security_notifications
  FOR SELECT TO authenticated
  USING (
    public.opa_security_current_role() = 'SUPER_ADMIN'
    OR recipient_user_id = auth.uid()
    OR recipient_role = public.opa_security_current_role()
    OR (public.opa_is_security_staff() AND recipient_role LIKE 'SECURITY%')
  );

DROP POLICY IF EXISTS security_notifications_insert ON public.security_notifications;
CREATE POLICY security_notifications_insert ON public.security_notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS security_notifications_update ON public.security_notifications;
CREATE POLICY security_notifications_update ON public.security_notifications
  FOR UPDATE TO authenticated
  USING (
    recipient_user_id = auth.uid()
    OR public.opa_security_current_role() = 'SUPER_ADMIN'
    OR recipient_role = public.opa_security_current_role()
  );

DROP POLICY IF EXISTS security_audit_insert ON public.security_audit_logs;
CREATE POLICY security_audit_insert ON public.security_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS security_audit_select ON public.security_audit_logs;
CREATE POLICY security_audit_select ON public.security_audit_logs
  FOR SELECT TO authenticated
  USING (
    public.opa_security_current_role() IN ('SUPER_ADMIN','SECURITY_HEAD')
  );

-- Realtime (optional, idempotent)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.visitor_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ceo_visit_requests;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.visitor_entries;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.security_notifications;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
