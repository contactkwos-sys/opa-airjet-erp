import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { hasPermission, type ModuleKey, type PermissionAction } from "@/lib/permissions";
import type { OpaProfile, OpaRole } from "@/types/database";
import { writeAuditLog } from "@/lib/audit";

const DEMO_PROFILE: OpaProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@opa.local",
  full_name: "Demo Super Admin",
  role: "SUPER_ADMIN",
  department_id: null,
  employee_id: "DEMO-001",
  mobile: null,
  is_active: true,
  permissions: {},
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

type AuthContextValue = {
  session: Session | null;
  profile: OpaProfile | null;
  role: OpaRole | null;
  loading: boolean;
  demoMode: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  can: (module: ModuleKey, action?: PermissionAction) => boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchProfile(userId: string): Promise<OpaProfile | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("opa_profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) {
    console.warn("[auth] profile fetch failed", error.message);
    return null;
  }
  return data as OpaProfile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [session, setSession] = useState<Session | null>(null);
  // Start in demo preview so deep links (/production etc.) never bounce to login
  // while Supabase session is still resolving. Real sessions replace this profile.
  const [profile, setProfile] = useState<OpaProfile | null>(DEMO_PROFILE);
  const [loading, setLoading] = useState(configured);
  const demoMode = !session && profile?.id === DEMO_PROFILE.id;

  useEffect(() => {
    if (!configured) {
      setProfile(DEMO_PROFILE);
      setLoading(false);
      return;
    }

    const sb = getSupabase();
    if (!sb) {
      setProfile(DEMO_PROFILE);
      setLoading(false);
      return;
    }

    let cancelled = false;

    sb.auth
      .getSession()
      .then(async ({ data }) => {
        if (cancelled) return;
        setSession(data.session);
        if (data.session?.user) {
          const p = await fetchProfile(data.session.user.id);
          if (!cancelled) setProfile(p);
        } else {
          // Offline / no session → demo preview
          setProfile(DEMO_PROFILE);
        }
      })
      .catch(() => {
        if (!cancelled) setProfile(DEMO_PROFILE);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const { data: sub } = sb.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      if (next?.user) {
        const p = await fetchProfile(next.user.id);
        setProfile(p);
      } else if (!isSupabaseConfigured()) {
        setProfile(DEMO_PROFILE);
      } else {
        setProfile(DEMO_PROFILE);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [configured]);

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = getSupabase();
    if (!sb) {
      setProfile(DEMO_PROFILE);
      return { error: null };
    }
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      const p = await fetchProfile(data.user.id);
      setProfile(p);
      await writeAuditLog({
        user_id: data.user.id,
        user_name: p?.full_name ?? email,
        action: "LOGIN",
        module: "auth",
      });
    }
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    const sb = getSupabase();
    if (profile) {
      await writeAuditLog({
        user_id: profile.id,
        user_name: profile.full_name,
        action: "LOGOUT",
        module: "auth",
      });
    }
    if (sb) await sb.auth.signOut();
    setSession(null);
    setProfile(isSupabaseConfigured() ? DEMO_PROFILE : DEMO_PROFILE);
  }, [profile]);

  const role = profile?.role ?? null;

  const can = useCallback(
    (module: ModuleKey, action: PermissionAction = "view") =>
      hasPermission(role, module, action),
    [role],
  );

  const value = useMemo(
    () => ({
      session,
      profile,
      role,
      loading,
      demoMode: Boolean(demoMode),
      signIn,
      signOut,
      can,
    }),
    [session, profile, role, loading, demoMode, signIn, signOut, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
