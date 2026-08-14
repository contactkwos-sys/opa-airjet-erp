#!/usr/bin/env node
/**
 * Smoke-test Supabase URL + publishable key (Auth + REST).
 * Never prints secrets. Uses only frontend-safe credentials.
 *
 * Refuses the known WRONG shared project (ixulyhomqtajenigopai).
 */

import { createClient } from "@supabase/supabase-js";

const WRONG_REFS = new Set(["ixulyhomqtajenigopai"]);

function trim(v) {
  return (v ?? "").trim();
}

function mask(v) {
  if (!v) return "(empty)";
  if (v.length <= 10) return "***";
  return `${v.slice(0, 6)}…${v.slice(-4)} (len=${v.length})`;
}

function projectRefFromUrl(url) {
  try {
    const host = new URL(url).hostname; // <ref>.supabase.co
    return host.split(".")[0] || "";
  } catch {
    return "";
  }
}

const url = trim(process.env.VITE_SUPABASE_URL) || trim(process.env.SUPABASE_URL);
const key =
  trim(process.env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  trim(process.env.VITE_SUPABASE_ANON_KEY) ||
  trim(process.env.SUPABASE_PUBLISHABLE_KEY);

if (!url || !key) {
  console.error(
    "[supabase:test] Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY for project opa-airjet-erp",
  );
  process.exit(1);
}

const ref = projectRefFromUrl(url);
console.log("[supabase:test] URL", url);
console.log("[supabase:test] Project ref", ref || "(unparsed)");
console.log("[supabase:test] Key", mask(key));

if (!ref) {
  console.error("[supabase:test] Could not parse project ref from URL");
  process.exit(1);
}

if (WRONG_REFS.has(ref)) {
  console.error(
    "[supabase:test] REFUSED: this URL belongs to the WRONG shared project",
    ref,
  );
  console.error(
    "[supabase:test] Use the new OPA AIR JET ERP (opa-airjet-erp) project URL instead.",
  );
  process.exit(2);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let failed = 0;

try {
  const res = await fetch(`${url}/auth/v1/health`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${body.slice(0, 120)}`);
  console.log("[supabase:test] Auth health OK", body.slice(0, 120));
} catch (err) {
  failed += 1;
  console.error("[supabase:test] Auth health FAIL", err instanceof Error ? err.message : err);
}

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

// REST root / a probe table — empty new project should 404 missing relation or return []
try {
  const res = await fetch(`${url}/rest/v1/`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  // Publishable key may 401 on OpenAPI root; that still proves edge routing.
  console.log("[supabase:test] REST root HTTP", res.status);
  if (res.status >= 500) {
    failed += 1;
    console.error("[supabase:test] REST unhealthy");
  } else {
    console.log("[supabase:test] REST endpoint reachable");
  }
} catch (err) {
  failed += 1;
  console.error("[supabase:test] REST FAIL", err instanceof Error ? err.message : err);
}

// Emptiness probe: opa_looms must NOT exist yet on a fresh project
try {
  const { error } = await sb.from("opa_looms").select("id").limit(1);
  if (!error) {
    console.log("[supabase:test] NOTE: opa_looms already exists (not an empty DB)");
  } else if (/Could not find the table|PGRST205|does not exist/i.test(error.message)) {
    console.log("[supabase:test] Emptiness check OK — opa_looms not present yet");
  } else {
    console.log("[supabase:test] REST probe:", error.message);
  }
} catch (err) {
  failed += 1;
  console.error("[supabase:test] Emptiness probe FAIL", err instanceof Error ? err.message : err);
}

if (failed) {
  console.error(`[supabase:test] FAILED (${failed})`);
  process.exit(1);
}

console.log("[supabase:test] PASS — Auth + REST healthy for project ref", ref);
console.log("[supabase:test] Migration NOT applied by this script.");
