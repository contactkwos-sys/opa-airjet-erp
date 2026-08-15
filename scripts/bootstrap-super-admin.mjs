#!/usr/bin/env node
/**
 * Step 1 — SUPER_ADMIN bootstrap against rjpwznapyaegotbswlke only.
 * Loads OPA_SUPABASE_SERVICE_ROLE_KEY from env or .env.opa.secret.
 * Never prints secret material.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

const CORRECT = "rjpwznapyaegotbswlke";
const WRONG = "ixulyhomqtajenigopai";
const BASE = `https://${CORRECT}.supabase.co`;
const ADMIN_EMAIL = "superadmin@opa-airjet.local";
const ADMIN_NAME = "OPA Super Admin";

function loadEnvFile(name) {
  const p = resolve(process.cwd(), name);
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i);
    const v = t.slice(i + 1);
    if (!process.env[k]) process.env[k] = v;
  }
}

function refFromJwt(key) {
  if (!key || !key.includes(".")) return null;
  try {
    return JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8")).ref || null;
  } catch {
    return null;
  }
}

function assertSafeKey(key) {
  if (!key) {
    console.log(JSON.stringify({ ok: false, error: "OPA_SUPABASE_SERVICE_ROLE_KEY missing" }));
    process.exit(2);
  }
  if (key.includes(WRONG) || key.includes("ixuly")) {
    console.log(JSON.stringify({ ok: false, error: "refused_wrong_project_marker_in_key" }));
    process.exit(2);
  }
  const ref = refFromJwt(key);
  if (ref === WRONG) {
    console.log(JSON.stringify({ ok: false, error: "refused_wrong_project_jwt_ref" }));
    process.exit(2);
  }
  if (ref && ref !== CORRECT) {
    console.log(JSON.stringify({ ok: false, error: "refused_unexpected_jwt_ref", ref }));
    process.exit(2);
  }
}

async function adminFetch(key, path, init = {}) {
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  const r = await fetch(`${BASE}${path}`, { ...init, headers });
  const text = await r.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text.slice(0, 200) };
  }
  return { status: r.status, json };
}

async function main() {
  loadEnvFile(".env");
  loadEnvFile(".env.opa.secret");
  // Never fall back to legacy SUPABASE_SERVICE_ROLE_KEY (known wrong project).
  const key = process.env.OPA_SUPABASE_SERVICE_ROLE_KEY || "";
  assertSafeKey(key);

  const projectCheck = {
    target: CORRECT,
    base: BASE,
    keyFormat: key.startsWith("sb_secret_") ? "sb_secret" : key.startsWith("eyJ") ? "jwt" : "other",
  };

  // Verify Admin API works on CORRECT project only
  const list = await adminFetch(key, "/auth/v1/admin/users?page=1&per_page=5");
  if (list.status === 401 || list.status === 403) {
    console.log(
      JSON.stringify({
        ok: false,
        step: "verify_admin_api",
        projectCheck,
        status: list.status,
        error: "admin_auth_rejected_on_correct_project",
      }),
    );
    process.exit(1);
  }
  if (list.status < 200 || list.status >= 300) {
    console.log(
      JSON.stringify({
        ok: false,
        step: "verify_admin_api",
        projectCheck,
        status: list.status,
        error: list.json?.message || list.json?.error || "admin_list_failed",
      }),
    );
    process.exit(1);
  }

  const users = list.json?.users || [];
  let user = users.find((u) => (u.email || "").toLowerCase() === ADMIN_EMAIL);
  let password = null;
  let created = false;

  if (!user) {
    password = `Opa-SA-${randomBytes(9).toString("base64url")}!`;
    const createdRes = await adminFetch(key, "/auth/v1/admin/users", {
      method: "POST",
      body: JSON.stringify({
        email: ADMIN_EMAIL,
        password,
        email_confirm: true,
        user_metadata: { full_name: ADMIN_NAME },
      }),
    });
    if (createdRes.status < 200 || createdRes.status >= 300) {
      console.log(
        JSON.stringify({
          ok: false,
          step: "create_auth_user",
          status: createdRes.status,
          error: createdRes.json?.message || createdRes.json?.msg || "create_failed",
        }),
      );
      process.exit(1);
    }
    user = createdRes.json;
    created = true;
  } else {
    // Reset password so local login can be verified deterministically
    password = `Opa-SA-${randomBytes(9).toString("base64url")}!`;
    const upd = await adminFetch(key, `/auth/v1/admin/users/${user.id}`, {
      method: "PUT",
      body: JSON.stringify({ password, email_confirm: true }),
    });
    if (upd.status < 200 || upd.status >= 300) {
      console.log(
        JSON.stringify({
          ok: false,
          step: "reset_password",
          status: upd.status,
          error: upd.json?.message || "password_reset_failed",
        }),
      );
      process.exit(1);
    }
  }

  const profileBody = {
    id: user.id,
    email: ADMIN_EMAIL,
    full_name: ADMIN_NAME,
    role: "SUPER_ADMIN",
    employee_id: "SA-001",
    is_active: true,
    permissions: {},
  };

  const upsert = await adminFetch(key, "/rest/v1/opa_profiles?on_conflict=id", {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(profileBody),
  });

  if (upsert.status < 200 || upsert.status >= 300) {
    console.log(
      JSON.stringify({
        ok: false,
        step: "upsert_opa_profiles",
        status: upsert.status,
        error: upsert.json?.message || upsert.json?.code || "profile_upsert_failed",
      }),
    );
    process.exit(1);
  }

  const profile = Array.isArray(upsert.json) ? upsert.json[0] : upsert.json;

  // Local login verification with publishable key (frontend path)
  const pub = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!pub) {
    console.log(JSON.stringify({ ok: false, step: "login", error: "missing_publishable_key" }));
    process.exit(1);
  }

  const login = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: pub,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email: ADMIN_EMAIL, password }),
  });
  const loginJson = await login.json().catch(() => ({}));
  if (!login.ok || !loginJson.access_token) {
    console.log(
      JSON.stringify({
        ok: false,
        step: "login",
        status: login.status,
        error: loginJson?.error_description || loginJson?.msg || "login_failed",
      }),
    );
    process.exit(1);
  }

  const profileRead = await fetch(
    `${BASE}/rest/v1/opa_profiles?select=id,email,role,is_active&id=eq.${user.id}`,
    {
      headers: {
        apikey: pub,
        Authorization: `Bearer ${loginJson.access_token}`,
      },
    },
  );
  const profiles = await profileRead.json().catch(() => []);
  const p = Array.isArray(profiles) ? profiles[0] : null;

  if (!p || p.role !== "SUPER_ADMIN" || p.is_active !== true) {
    console.log(
      JSON.stringify({
        ok: false,
        step: "profile_after_login",
        status: profileRead.status,
        profile: p ? { email: p.email, role: p.role, is_active: p.is_active } : null,
        error: "profile_not_super_admin_or_unreadable",
      }),
    );
    process.exit(1);
  }

  // Write login creds to gitignored file for operator (not the service role)
  const credPath = resolve(process.cwd(), ".env.opa.admin");
  const credBody = [
    "# Gitignored local SUPER_ADMIN login (not service role)",
    `OPA_ADMIN_EMAIL=${ADMIN_EMAIL}`,
    `OPA_ADMIN_PASSWORD=${password}`,
    `OPA_ADMIN_USER_ID=${user.id}`,
    "",
  ].join("\n");
  await import("node:fs").then((fs) => fs.writeFileSync(credPath, credBody, { mode: 0o600 }));

  console.log(
    JSON.stringify(
      {
        ok: true,
        projectVerification: "PASS",
        projectRef: CORRECT,
        superAdminSetup: "PASS",
        authUserCreated: created,
        email: ADMIN_EMAIL,
        userId: user.id,
        profileRole: profile?.role || p.role,
        localLogin: "PASS",
        credentialsFile: ".env.opa.admin",
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.log(JSON.stringify({ ok: false, error: String(e?.message || e) }));
  process.exit(1);
});
