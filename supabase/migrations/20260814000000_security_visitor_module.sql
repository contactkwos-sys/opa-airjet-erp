-- OPA Group of India — Security + Visitor Management Module
-- Apply in Supabase SQL editor or via supabase db push

-- Profiles (extends auth.users) — reuse if already present
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'SECURITY_GUARD'
    CHECK (role IN (
      'SUPER_ADMIN','CEO','DIRECTOR','SECURITY_HEAD','SECURITY_GUARD','FACTORY_MANAGER'
    )),
  mobile TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS visitor_requests_active_mobile_date_idx
  ON public.visitor_requests (mobile, requested_date)
  WHERE status NOT IN ('CANCELLED','REJECTED','EXITED','COMPLETED');

CREATE TABLE IF NOT EXISTS public.ceo_visit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_request_id UUID NOT NULL REFERENCES public.visitor_requests(id) ON DELETE CASCADE,
  request_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING_CEO_APPROVAL',
  ceo_decision TEXT CHECK (ceo_decision IN ('APPROVED','REJECTED','RESCHEDULED')),
  ceo_remarks TEXT,
  decision_by UUID REFERENCES public.profiles(id),
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

CREATE TABLE IF NOT EXISTS public.visitor_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_request_id UUID NOT NULL REFERENCES public.visitor_requests(id),
  gate_pass_number TEXT NOT NULL UNIQUE,
  actual_arrival_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  check_in_by UUID REFERENCES public.profiles(id),
  visitor_photo_url TEXT,
  id_verified BOOLEAN NOT NULL DEFAULT false,
  actual_vehicle_number TEXT,
  number_of_persons INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'INSIDE' CHECK (status IN ('INSIDE','EXITED')),
  exit_time TIMESTAMPTZ,
  check_out_by UUID REFERENCES public.profiles(id),
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

CREATE TABLE IF NOT EXISTS public.security_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_type TEXT NOT NULL,
  reference_id UUID,
  recipient_role TEXT,
  recipient_user_id UUID REFERENCES public.profiles(id),
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
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

-- Helper: current user's role
CREATE OR REPLACE FUNCTION public.current_app_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role FROM public.profiles WHERE id = auth.uid()),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.is_security_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_app_role() IN (
    'SUPER_ADMIN','SECURITY_HEAD','SECURITY_GUARD'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_ceo_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_app_role() IN ('SUPER_ADMIN','CEO','DIRECTOR');
$$;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ceo_visit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visitor_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vehicle_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_gate_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles: users see own; super admin all
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.current_app_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (id = auth.uid() OR public.current_app_role() = 'SUPER_ADMIN');

-- Visitor requests
DROP POLICY IF EXISTS visitor_requests_security_all ON public.visitor_requests;
CREATE POLICY visitor_requests_security_all ON public.visitor_requests
  FOR ALL USING (
    public.is_security_staff()
    OR public.current_app_role() = 'FACTORY_MANAGER'
    OR public.is_ceo_or_admin()
  )
  WITH CHECK (public.is_security_staff() OR public.current_app_role() = 'SUPER_ADMIN');

-- CEO visit requests: CEO can view/update decisions; security can create/view
DROP POLICY IF EXISTS ceo_requests_select ON public.ceo_visit_requests;
CREATE POLICY ceo_requests_select ON public.ceo_visit_requests
  FOR SELECT USING (public.is_ceo_or_admin() OR public.is_security_staff());

DROP POLICY IF EXISTS ceo_requests_insert ON public.ceo_visit_requests;
CREATE POLICY ceo_requests_insert ON public.ceo_visit_requests
  FOR INSERT WITH CHECK (public.is_security_staff() OR public.current_app_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS ceo_requests_update ON public.ceo_visit_requests;
CREATE POLICY ceo_requests_update ON public.ceo_visit_requests
  FOR UPDATE USING (public.is_ceo_or_admin() OR public.current_app_role() = 'SUPER_ADMIN');

-- Visitor entries
DROP POLICY IF EXISTS visitor_entries_security ON public.visitor_entries;
CREATE POLICY visitor_entries_security ON public.visitor_entries
  FOR ALL USING (public.is_security_staff() OR public.current_app_role() IN ('SUPER_ADMIN','FACTORY_MANAGER'))
  WITH CHECK (public.is_security_staff() OR public.current_app_role() = 'SUPER_ADMIN');

-- Incidents / vehicles / material
DROP POLICY IF EXISTS incidents_security ON public.security_incidents;
CREATE POLICY incidents_security ON public.security_incidents
  FOR ALL USING (public.is_security_staff() OR public.current_app_role() IN ('SUPER_ADMIN','FACTORY_MANAGER'))
  WITH CHECK (public.is_security_staff() OR public.current_app_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS vehicles_security ON public.vehicle_entries;
CREATE POLICY vehicles_security ON public.vehicle_entries
  FOR ALL USING (public.is_security_staff() OR public.current_app_role() IN ('SUPER_ADMIN','FACTORY_MANAGER'))
  WITH CHECK (public.is_security_staff() OR public.current_app_role() = 'SUPER_ADMIN');

DROP POLICY IF EXISTS material_security ON public.material_gate_entries;
CREATE POLICY material_security ON public.material_gate_entries
  FOR ALL USING (public.is_security_staff() OR public.current_app_role() IN ('SUPER_ADMIN','FACTORY_MANAGER'))
  WITH CHECK (public.is_security_staff() OR public.current_app_role() = 'SUPER_ADMIN');

-- Notifications
DROP POLICY IF EXISTS notifications_select ON public.security_notifications;
CREATE POLICY notifications_select ON public.security_notifications
  FOR SELECT USING (
    public.current_app_role() = 'SUPER_ADMIN'
    OR recipient_user_id = auth.uid()
    OR recipient_role = public.current_app_role()
    OR (public.is_security_staff() AND recipient_role LIKE 'SECURITY%')
  );

DROP POLICY IF EXISTS notifications_insert ON public.security_notifications;
CREATE POLICY notifications_insert ON public.security_notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS notifications_update ON public.security_notifications;
CREATE POLICY notifications_update ON public.security_notifications
  FOR UPDATE USING (
    recipient_user_id = auth.uid()
    OR public.current_app_role() = 'SUPER_ADMIN'
    OR recipient_role = public.current_app_role()
  );

-- Audit logs: insert by authenticated; read by security head / admin
DROP POLICY IF EXISTS audit_insert ON public.audit_logs;
CREATE POLICY audit_insert ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS audit_select ON public.audit_logs;
CREATE POLICY audit_select ON public.audit_logs
  FOR SELECT USING (public.current_app_role() IN ('SUPER_ADMIN','SECURITY_HEAD'));

-- Realtime (optional)
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

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'SECURITY_GUARD')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
