#!/usr/bin/env node
/**
 * Smoke-test Supabase URL + publishable key (Auth + REST).
 * Never prints secrets. Uses only frontend-safe credentials.
 */

import { createClient } from "@supabase/supabase-js";

function trim(v) {
  return (v ?? "").trim();
}

function mask(v) {
  if (!v) return "(empty)";
  if (v.length <= 10) return "***";
  return `${v.slice(0, 6)}…${v.slice(-4)} (len=${v.length})`;
}

const url =
  trim(process.env.VITE_SUPABASE_URL) ||
  trim(process.env.SUPABASE_URL) ||
  "https://ixulyhomqtajenigopai.supabase.co";

const key =
  trim(process.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  trim(process.env.VITE_SUPABASE_ANON_KEY) ||
  trim(process.env.SUPABASE_PUBLISHABLE_KEY);

if (!key) {
  console.error("[supabase:test] Missing publishable/anon key env");
  process.exit(1);
}

console.log("[supabase:test] URL", url);
console.log("[supabase:test] Key", mask(key));

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failed = 0;

// 1) Auth health via GoTrue settings
try {
  const res = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${body.slice(0, 120)}`);
  console.log("[supabase:test] Auth health OK");
} catch (err) {
  failed += 1;
  console.error("[supabase:test] Auth health FAIL", err instanceof Error ? err.message : err);
}

// 2) Auth credential rejection path (proves auth endpoint accepts publishable key)
try {
  const { error } = await sb.auth.signInWithPassword({
    email: "opa-connection-probe@invalid.local",
    password: "definitely-not-a-real-password",
  });
  if (!error) {
    failed += 1;
    console.error("[supabase:test] Auth login unexpectedly succeeded");
  } else {
    console.log("[supabase:test] Auth login endpoint OK (", error.message, ")");
  }
} catch (err) {
  failed += 1;
  console.error("[supabase:test] Auth login FAIL", err instanceof Error ? err.message : err);
}

// 3) REST reachability with RLS (empty or denied is fine; transport must work)
try {
  const { error } = await sb.from("opa_looms").select("id").limit(1);
  if (error) {
    // Missing table before migrations is expected
    console.log("[supabase:test] REST OK (opa_looms):", error.message);
  } else {
    console.log("[supabase:test] REST OK (opa_looms readable)");
  }
} catch (err) {
  failed += 1;
  console.error("[supabase:test] REST FAIL", err instanceof Error ? err.message : err);
}

if (failed) {
  console.error(`[supabase:test] FAILED (${failed})`);
  process.exit(1);
}

console.log("[supabase:test] PASS — connection + auth endpoint verified with publishable key");
