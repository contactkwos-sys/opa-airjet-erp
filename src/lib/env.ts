/** Reads Vite-exposed Supabase env. */

function trim(value: string | undefined): string {
  return (value ?? "").trim();
}

const PLACEHOLDER_KEYS = new Set([
  "",
  "your_anon_key",
  "your_publishable_or_anon_key",
  "your_publishable_key",
]);

/** Vite injects `import.meta.env`; under Node smoke tests it may be undefined. */
function viteEnv(): Record<string, string | undefined> {
  try {
    return (
      (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env ?? {}
    );
  } catch {
    return {};
  }
}

/** Prefer publishable key; keep anon key as backward-compatible alias. */
function resolvePublishableKey(): string {
  const e = viteEnv();
  return trim(e.VITE_SUPABASE_PUBLISHABLE_KEY) || trim(e.VITE_SUPABASE_ANON_KEY);
}

export const env = {
  supabaseUrl: trim(viteEnv().VITE_SUPABASE_URL),
  /** Publishable or legacy anon key (never service role). */
  supabaseAnonKey: resolvePublishableKey(),
  supabasePublishableKey: resolvePublishableKey(),
};

export function isSupabaseConfigured(): boolean {
  const { supabaseUrl, supabasePublishableKey } = env;
  return Boolean(
    supabaseUrl &&
      supabasePublishableKey &&
      !supabaseUrl.includes("YOUR_PROJECT") &&
      !PLACEHOLDER_KEYS.has(supabasePublishableKey),
  );
}
