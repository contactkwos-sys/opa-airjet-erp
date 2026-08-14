import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env, isSupabaseConfigured as envConfigured } from "./env";

const url = env.supabaseUrl;
const publishableKey = env.supabasePublishableKey;

/** Boolean flag used by Security module (local-store fallback when false). */
export const isSupabaseConfigured = envConfigured();

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;
  if (!client) {
    client = createClient(url, publishableKey, {
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
      "Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).",
    );
  }
  return sb;
}
