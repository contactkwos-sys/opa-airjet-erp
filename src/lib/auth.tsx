import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AppRole, Profile } from "../types/security";
import { isSupabaseConfigured, supabase } from "./supabase";
import { ROLE_LABELS } from "./roles";

interface AuthState {
  user: Profile | null;
  loading: boolean;
  mode: "supabase" | "local";
  loginLocal: (role: AppRole, name?: string) => void;
  loginSupabase: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);
const LOCAL_KEY = "opa_local_user";

const DEMO_USERS: Record<AppRole, Profile> = {
  SUPER_ADMIN: {
    id: "local-super-admin",
    email: "admin@opagroup.local",
    full_name: "OPA Super Admin",
    role: "SUPER_ADMIN",
    created_at: new Date().toISOString(),
  },
  CEO: {
    id: "local-ceo",
    email: "ceo@opagroup.local",
    full_name: "OPA CEO",
    role: "CEO",
    mobile: "",
    created_at: new Date().toISOString(),
  },
  DIRECTOR: {
    id: "local-director",
    email: "director@opagroup.local",
    full_name: "OPA Director",
    role: "DIRECTOR",
    created_at: new Date().toISOString(),
  },
  SECURITY_HEAD: {
    id: "local-security-head",
    email: "security.head@opagroup.local",
    full_name: "Security Head",
    role: "SECURITY_HEAD",
    created_at: new Date().toISOString(),
  },
  SECURITY_GUARD: {
    id: "local-security-guard",
    email: "security.guard@opagroup.local",
    full_name: "Security Guard",
    role: "SECURITY_GUARD",
    created_at: new Date().toISOString(),
  },
  FACTORY_MANAGER: {
    id: "local-factory-manager",
    email: "factory@opagroup.local",
    full_name: "Factory Manager",
    role: "FACTORY_MANAGER",
    created_at: new Date().toISOString(),
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const mode: "supabase" | "local" = isSupabaseConfigured ? "supabase" : "local";

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (isSupabaseConfigured && supabase) {
        const { data } = await supabase.auth.getSession();
        if (data.session?.user) {
          const profile = await loadProfile(data.session.user.id, data.session.user.email ?? "");
          if (mounted) setUser(profile);
        }
        const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (!session?.user) {
            setUser(null);
            return;
          }
          const profile = await loadProfile(session.user.id, session.user.email ?? "");
          setUser(profile);
        });
        if (mounted) setLoading(false);
        return () => sub.subscription.unsubscribe();
      }

      try {
        const raw = localStorage.getItem(LOCAL_KEY);
        if (raw && mounted) setUser(JSON.parse(raw) as Profile);
      } catch {
        /* ignore */
      }
      if (mounted) setLoading(false);
      return undefined;
    }

    const cleanup = init();
    return () => {
      mounted = false;
      void cleanup.then((fn) => fn?.());
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      loading,
      mode,
      loginLocal: (role, name) => {
        const base = DEMO_USERS[role];
        const next = { ...base, full_name: name?.trim() || base.full_name };
        localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
        setUser(next);
      },
      loginSupabase: async (email, password) => {
        if (!supabase) return "Supabase is not configured";
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return error?.message ?? null;
      },
      logout: async () => {
        localStorage.removeItem(LOCAL_KEY);
        if (supabase) await supabase.auth.signOut();
        setUser(null);
      },
    }),
    [user, loading, mode]
  );

  return createElement(AuthContext.Provider, { value }, children);
}

const SECURITY_ROLES = new Set([
  "SUPER_ADMIN",
  "CEO",
  "DIRECTOR",
  "SECURITY_HEAD",
  "SECURITY_GUARD",
  "FACTORY_MANAGER",
]);

async function loadProfile(userId: string, email: string): Promise<Profile> {
  if (!supabase) {
    return {
      id: userId,
      email,
      full_name: email,
      role: "SECURITY_GUARD",
      created_at: new Date().toISOString(),
    };
  }

  // Prefer OPA ERP profiles (role-aware). Avoid shared CRM public.profiles.
  const opa = await supabase
    .from("opa_profiles")
    .select("id,email,full_name,role,mobile,created_at")
    .eq("id", userId)
    .maybeSingle();

  if (opa.data && SECURITY_ROLES.has(String(opa.data.role))) {
    return opa.data as Profile;
  }

  const legacy = await supabase
    .from("profiles")
    .select("id,email,full_name,role,mobile,created_at")
    .eq("id", userId)
    .maybeSingle();

  if (legacy.data && SECURITY_ROLES.has(String(legacy.data.role))) {
    return legacy.data as Profile;
  }

  return {
    id: userId,
    email,
    full_name: (opa.data?.full_name as string | undefined) || email,
    role: "SECURITY_GUARD",
    created_at: new Date().toISOString(),
  };
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export { ROLE_LABELS, DEMO_USERS };
