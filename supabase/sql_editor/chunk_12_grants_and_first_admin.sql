-- =============================================================================
-- LIVE bootstrap — GRANTs + first Auth user → SUPER_ADMIN profile
-- Project: rjpwznapyaegotbswlke (OPA AIR JET ERP) ONLY
-- Paste in SQL Editor AFTER Auth user is created (or before — trigger covers new users)
-- =============================================================================

-- Table privileges for logged-in users (RLS still applies)
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND (
        c.relname LIKE 'opa_%'
        OR c.relname IN (
          'visitor_requests','ceo_visit_requests','visitor_entries',
          'security_incidents','vehicle_entries','material_gate_entries',
          'security_notifications','security_audit_logs','audit_logs','profiles'
        )
      )
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', r.tbl);
  END LOOP;

  FOR r IN
    SELECT c.relname AS seq
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'S'
  LOOP
    EXECUTE format('GRANT USAGE, SELECT ON SEQUENCE public.%I TO authenticated', r.seq);
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;

-- Auto-create opa_profiles: first user = SUPER_ADMIN, later = LOOM_OPERATOR
CREATE OR REPLACE FUNCTION public.opa_handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_role opa_role;
  v_name text;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.opa_profiles;
  IF v_count = 0 THEN
    v_role := 'SUPER_ADMIN';
  ELSE
    v_role := 'LOOM_OPERATOR';
  END IF;

  v_name := COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    split_part(COALESCE(NEW.email, 'user'), '@', 1),
    'OPA User'
  );

  INSERT INTO public.opa_profiles (id, email, full_name, role, employee_id, is_active, permissions)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.id::text || '@opa.local'),
    v_name,
    v_role,
    CASE WHEN v_role = 'SUPER_ADMIN' THEN 'SA-001' ELSE NULL END,
    TRUE,
    '{}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(NULLIF(opa_profiles.full_name, ''), EXCLUDED.full_name),
    role = CASE
      WHEN opa_profiles.role = 'SUPER_ADMIN' THEN opa_profiles.role
      WHEN v_count = 0 THEN 'SUPER_ADMIN'::opa_role
      ELSE opa_profiles.role
    END,
    is_active = TRUE,
    updated_at = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opa_on_auth_user_created ON auth.users;
CREATE TRIGGER trg_opa_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.opa_handle_new_auth_user();

-- Backfill: any auth user missing opa_profiles (first becomes SUPER_ADMIN)
DO $$
DECLARE
  u record;
  v_count integer;
  v_role opa_role;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.opa_profiles;
  FOR u IN SELECT id, email, raw_user_meta_data FROM auth.users ORDER BY created_at ASC
  LOOP
    IF EXISTS (SELECT 1 FROM public.opa_profiles WHERE id = u.id) THEN
      CONTINUE;
    END IF;
    IF v_count = 0 THEN
      v_role := 'SUPER_ADMIN';
    ELSE
      v_role := 'LOOM_OPERATOR';
    END IF;
    INSERT INTO public.opa_profiles (id, email, full_name, role, employee_id, is_active)
    VALUES (
      u.id,
      COALESCE(u.email, u.id::text || '@opa.local'),
      COALESCE(u.raw_user_meta_data->>'full_name', split_part(COALESCE(u.email, 'user'), '@', 1), 'OPA User'),
      v_role,
      CASE WHEN v_role = 'SUPER_ADMIN' THEN 'SA-001' ELSE NULL END,
      TRUE
    );
    v_count := v_count + 1;
  END LOOP;
END $$;

SELECT id, email, full_name, role, is_active FROM public.opa_profiles ORDER BY created_at;
