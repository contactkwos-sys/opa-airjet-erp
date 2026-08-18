import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { hasPermission, type ModuleKey, type PermissionAction } from "@/lib/permissions";
import type { OpaProfile, OpaRole } from "@/types/database";
import { writeAuditLog } from "@/lib/audit";

type AuthContextValue = {
  session: Session | null;
  profile: OpaProfile | null;
  role: OpaRole | null;
  loading: boolean;
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
  const [profile, setProfile] = useState<OpaProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!configured) {
      setSession(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    const sb = getSupabase();
    if (!sb) {
      setSession(null);
      setProfile(null);
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
          setProfile(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSession(null);
          setProfile(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const { data: sub } = sb.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      if (next?.user) {
        const p = await fetchProfile(next.user.id);
        setProfile(p);
      } else {
        setProfile(null);
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
      return { error: "Database is not configured. Cannot sign in." };
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
    setProfile(null);
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
      signIn,
      signOut,
      can,
    }),
    [session, profile, role, loading, signIn, signOut, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
