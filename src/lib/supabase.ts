import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const env = (import.meta as ImportMeta & { env?: Record<string, string> }).env ?? {};
const url = (env.VITE_SUPABASE_URL ?? "").trim();
const anonKey = (env.VITE_SUPABASE_ANON_KEY ?? "").trim();

/** Boolean flag used by Security module (local-store fallback when false). */
export const isSupabaseConfigured = Boolean(
  url &&
    anonKey &&
    !url.includes("YOUR_PROJECT") &&
    anonKey !== "your_anon_key" &&
    anonKey !== "your_publishable_or_anon_key"
);

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

/** Shared client — null when not configured (Demo / local Security mode). */
export const supabase: SupabaseClient | null = getSupabase();

export function requireSupabase(): SupabaseClient {
  const sb = getSupabase();
  if (!sb) {
    throw new Error(
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
    );
  }
  return sb;
}
