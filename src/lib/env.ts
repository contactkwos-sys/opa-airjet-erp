/** Reads Vite-exposed Supabase env. Empty anon key → Demo Mode (no remote auth). */

function trim(value: string | undefined): string {
  return (value ?? "").trim();
}

export const env = {
  supabaseUrl: trim(import.meta.env.VITE_SUPABASE_URL),
  supabaseAnonKey: trim(import.meta.env.VITE_SUPABASE_ANON_KEY),
};

export function isSupabaseConfigured(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseAnonKey);
}
