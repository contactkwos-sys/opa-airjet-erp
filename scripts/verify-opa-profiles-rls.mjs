#!/usr/bin/env node
/**
 * Live RLS verification for opa_profiles hardening.
 * Uses OPA project URL + publishable + service role. Never prints secrets.
 *
 * Env:
 *   OPA_SUPABASE_SERVICE_ROLE_KEY (required)
 *   OPA_SUPABASE_PUBLISHABLE_KEY or file .env.opa.secret (required)
 *   .env.opa.admin for SUPER_ADMIN login (optional; created during Step 1)
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const PROJECT = process.env.OPA_SUPABASE_PROJECT_REF || "rjpwznapyaegotbswlke";
const BASE = `https://${PROJECT}.supabase.co`;

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const secretFile = loadEnvFile(resolve(process.cwd(), ".env.opa.secret"));
const adminFile = loadEnvFile(resolve(process.cwd(), ".env.opa.admin"));

const SERVICE =
  process.env.OPA_SUPABASE_SERVICE_ROLE_KEY ||
  secretFile.OPA_SUPABASE_SERVICE_ROLE_KEY;
const PUB =
  process.env.OPA_SUPABASE_PUBLISHABLE_KEY ||
  secretFile.OPA_SUPABASE_PUBLISHABLE_KEY;

if (!SERVICE || !PUB) {
  console.error("[rls:verify] Missing OPA service role and/or publishable key");
  process.exit(1);
}

async function req(method, path, bearer, apikey, body, query = "") {
  const res = await fetch(`${BASE}${path}${query}`, {
    method,
    headers: {
      apikey,
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed };
}

function pass(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  return ok;
}

function denied(status, body) {
  if (status === 401 || status === 403) return true;
  const blob = JSON.stringify(body || {}).toLowerCase();
  return (
    body?.code === "42501" ||
    blob.includes("permission denied") ||
    blob.includes("privileged fields")
  );
}

async function main() {
  const results = [];

  // Anon blocked
  let r = await req("GET", "/rest/v1/opa_profiles", PUB, PUB, null, "?select=id&limit=1");
  results.push(pass("anon cannot select opa_profiles", denied(r.status, r.body), `HTTP ${r.status}`));
  r = await req("GET", "/rest/v1/opa_looms", PUB, PUB, null, "?select=id&limit=1");
  results.push(pass("anon cannot select opa_looms", denied(r.status, r.body), `HTTP ${r.status}`));

  // SUPER_ADMIN login + access
  const email = adminFile.OPA_ADMIN_EMAIL || "superadmin@opa-airjet.local";
  const password = adminFile.OPA_ADMIN_PASSWORD;
  const adminId = adminFile.OPA_ADMIN_USER_ID;
  if (!password) {
    console.error("[rls:verify] Missing .env.opa.admin password — skip auth tests");
    process.exit(results.every(Boolean) ? 0 : 1);
  }

  r = await req("POST", "/auth/v1/token", PUB, PUB, { email, password }, "?grant_type=password");
  const adminTok = r.body?.access_token;
  results.push(pass("SUPER_ADMIN client login", r.status === 200 && !!adminTok, `HTTP ${r.status}`));

  if (adminTok) {
    r = await req(
      "GET",
      "/rest/v1/opa_profiles",
      adminTok,
      PUB,
      null,
      `?select=id,role,is_active&id=eq.${adminId}`,
    );
    const row = Array.isArray(r.body) ? r.body[0] : null;
    results.push(
      pass(
        "SUPER_ADMIN reads own profile",
        r.status === 200 && row?.role === "SUPER_ADMIN" && row?.is_active === true,
        `HTTP ${r.status} role=${row?.role}`,
      ),
    );
    r = await req("GET", "/rest/v1/opa_profiles", adminTok, PUB, null, "?select=id,role");
    results.push(
      pass(
        "SUPER_ADMIN can list profiles",
        r.status === 200 && Array.isArray(r.body) && r.body.length >= 1,
        `HTTP ${r.status} count=${Array.isArray(r.body) ? r.body.length : "n/a"}`,
      ),
    );
  }

  // Guard user lifecycle
  const guardEmail = "rlscheck@opa-airjet.local";
  const guardPassword = `Test!${Math.random().toString(36).slice(2)}A9`;
  r = await req("POST", "/auth/v1/admin/users", SERVICE, SERVICE, {
    email: guardEmail,
    password: guardPassword,
    email_confirm: true,
  });
  let guardId = r.body?.id;
  if (!guardId && r.status === 422) {
    const listed = await req("GET", "/auth/v1/admin/users", SERVICE, SERVICE, null, "?page=1&per_page=50");
    const found = (listed.body?.users || []).find((u) => u.email === guardEmail);
    guardId = found?.id;
    if (guardId) {
      await req("PUT", `/auth/v1/admin/users/${guardId}`, SERVICE, SERVICE, {
        password: guardPassword,
        email_confirm: true,
      });
    }
  }
  results.push(pass("create SECURITY_GUARD test user", !!guardId, `HTTP ${r.status}`));

  if (guardId) {
    await req(
      "POST",
      "/rest/v1/opa_profiles",
      SERVICE,
      SERVICE,
      {
        id: guardId,
        email: guardEmail,
        full_name: "RLS Check",
        role: "SECURITY_GUARD",
        is_active: true,
        employee_id: "RLS-001",
      },
      "?on_conflict=id",
    );

    r = await req(
      "POST",
      "/auth/v1/token",
      PUB,
      PUB,
      { email: guardEmail, password: guardPassword },
      "?grant_type=password",
    );
    const guardTok = r.body?.access_token;
    results.push(pass("SECURITY_GUARD client login", !!guardTok, `HTTP ${r.status}`));

    if (guardTok) {
      r = await req(
        "GET",
        "/rest/v1/opa_profiles",
        guardTok,
        PUB,
        null,
        `?select=id,role&id=eq.${guardId}`,
      );
      results.push(
        pass(
          "SECURITY_GUARD reads own profile",
          r.status === 200 && r.body?.[0]?.role === "SECURITY_GUARD",
          `HTTP ${r.status}`,
        ),
      );

      r = await req(
        "GET",
        "/rest/v1/opa_profiles",
        guardTok,
        PUB,
        null,
        `?select=id,role&id=eq.${adminId}`,
      );
      const crossBlocked =
        denied(r.status, r.body) || (Array.isArray(r.body) && r.body.length === 0);
      results.push(
        pass("SECURITY_GUARD cannot read SUPER_ADMIN profile", crossBlocked, `HTTP ${r.status}`),
      );

      r = await req(
        "GET",
        "/rest/v1/opa_profiles",
        guardTok,
        PUB,
        null,
        "?select=id,role",
      );
      const listOk =
        r.status === 200 &&
        Array.isArray(r.body) &&
        r.body.length === 1 &&
        r.body[0]?.id === guardId;
      results.push(
        pass("SECURITY_GUARD list is self-only", listOk, `count=${Array.isArray(r.body) ? r.body.length : "n/a"}`),
      );

      r = await req(
        "PATCH",
        "/rest/v1/opa_profiles",
        guardTok,
        PUB,
        { role: "SUPER_ADMIN" },
        `?id=eq.${guardId}`,
      );
      const verify = await req(
        "GET",
        "/rest/v1/opa_profiles",
        SERVICE,
        SERVICE,
        null,
        `?select=role&id=eq.${guardId}`,
      );
      const roleAfter = verify.body?.[0]?.role;
      results.push(
        pass(
          "SECURITY_GUARD cannot self-escalate role",
          roleAfter === "SECURITY_GUARD",
          `patch HTTP ${r.status} role_after=${roleAfter}`,
        ),
      );
    }

    await req("DELETE", `/auth/v1/admin/users/${guardId}`, SERVICE, SERVICE);
    await req("DELETE", "/rest/v1/opa_profiles", SERVICE, SERVICE, null, `?id=eq.${guardId}`);
  }

  const ok = results.every(Boolean);
  console.log(ok ? "\nRLS VERIFY: PASS" : "\nRLS VERIFY: FAIL");
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error("[rls:verify]", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
