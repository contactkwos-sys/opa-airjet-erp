import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { FunctionsHttpError, type Session } from "@supabase/supabase-js";
import { getSupabase } from "@/lib/supabase";
import { isSupabaseConfigured } from "@/lib/env";
import { hasPermission, type ModuleKey, type PermissionAction } from "@/lib/permissions";
import type { OpaProfile, OpaRole } from "@/types/database";
import { writeAuditLog } from "@/lib/audit";

/** Prefer the Edge Function JSON `{ error }` body over the generic non-2xx message. */
async function edgeFunctionErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string } | null;
      if (body?.error && typeof body.error === "string") return body.error;
    } catch {
      /* body already consumed or not JSON */
    }
  }
  if (error && typeof error === "object" && "message" in error) {
    const msg = String((error as { message?: string }).message ?? "");
    if (msg && !msg.toLowerCase().includes("non-2xx")) return msg;
  }
  return fallback;
}

type AuthContextValue = {
  session: Session | null;
  profile: OpaProfile | null;
  role: OpaRole | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signInWithPin: (
    role: OpaRole,
    pin: string,
    employeeId?: string | null,
  ) => Promise<{ error: string | null }>;
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
        if (!data.session) {
          setSession(null);
          setProfile(null);
          return;
        }
        // Validate token with the server — clears corrupt/stale local sessions
        // that would otherwise crash the login redirect path.
        const { data: userData, error: userError } = await sb.auth.getUser();
        if (cancelled) return;
        if (userError || !userData.user) {
          await sb.auth.signOut();
          if (!cancelled) {
            setSession(null);
            setProfile(null);
          }
          return;
        }
        setSession(data.session);
        const p = await fetchProfile(userData.user.id);
        if (!cancelled) setProfile(p);
      })
      .catch(async () => {
        try {
          await sb.auth.signOut();
        } catch {
          /* ignore */
        }
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

  const signInWithPin = useCallback(async (
    role: OpaRole,
    pin: string,
    employeeId?: string | null,
  ) => {
    const sb = getSupabase();
    if (!sb) {
      return { error: "Database is not configured. Cannot sign in." };
    }
    if (!/^\d{4}$/.test(pin)) {
      return { error: "Enter a 4-digit PIN." };
    }

    const { data, error } = await sb.functions.invoke("pin-login", {
      body: {
        role,
        pin,
        ...(employeeId ? { employee_id: employeeId } : {}),
      },
    });

    const payload = data as {
      error?: string;
      session?: { access_token: string; refresh_token: string };
      user?: { id: string; email: string; full_name?: string; role?: string };
    } | null;

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("failed to send") || msg.includes("fetch")) {
        return { error: "PIN login service is unavailable. Try again later." };
      }
      // Non-2xx (wrong PIN / locked) — surface server message, not generic FunctionsHttpError.
      if (payload?.error) return { error: payload.error };
      return {
        error: await edgeFunctionErrorMessage(error, "PIN login failed."),
      };
    }

    if (!payload || payload.error || !payload.session?.access_token || !payload.session.refresh_token) {
      return { error: payload?.error ?? "Invalid PIN." };
    }

    const { error: sessionError } = await sb.auth.setSession({
      access_token: payload.session.access_token,
      refresh_token: payload.session.refresh_token,
    });
    if (sessionError) return { error: sessionError.message };

    const userId = payload.user?.id;
    if (userId) {
      const p = await fetchProfile(userId);
      setProfile(p);
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
      signInWithPin,
      signOut,
      can,
    }),
    [session, profile, role, loading, signIn, signInWithPin, signOut, can],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
