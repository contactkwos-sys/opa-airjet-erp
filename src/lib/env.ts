/** Reads Vite-exposed Supabase env. Empty anon key → Demo Mode (no remote auth). */

function trim(value: string | undefined): string {
  return (value ?? "").trim();
}

export const env = {
  supabaseUrl: trim(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: trim(import.meta.env.VITE_SUPABASE_ANON_KEY),
};

export function isSupabaseConfigured(): boolean {
  const { supabaseUrl, supabaseAnonKey } = env;
  return Boolean(
    supabaseUrl &&
      supabaseAnonKey &&
      !supabaseUrl.includes("YOUR_PROJECT") &&
      supabaseAnonKey !== "your_anon_key" &&
      supabaseAnonKey !== "your_publishable_or_anon_key"
  );
}
