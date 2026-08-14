#!/usr/bin/env node
/**
 * Optional migration applier for the CORRECT opa-airjet-erp project only.
 *
 * Prefer: paste supabase/sql_editor/01_OPA_AIRJET_ERP_FULL_MIGRATION.sql
 * into the Supabase SQL Editor of project "OPA AIR JET ERP".
 *
 * This script REFUSES the wrong shared project ixulyhomqtajenigopai.
 * It will not invent IPv6 workarounds or use unsafe connections.
 *
 * Auth (only if you intentionally apply from CI against the CORRECT project):
 *   SUPABASE_PROJECT_REF   — project ref from URL host (required)
 *   DATABASE_URL           — supported pooler URI for that project, OR
 *   SUPABASE_ACCESS_TOKEN  — Management API token
 *
 * Default without --force-apply: plan/preflight only (no SQL executed).
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const WRONG_REF = "ixulyhomqtajenigopai";

function maskSecret(value) {
  if (!value) return "(empty)";
  if (value.length <= 8) return "***";
  return `${value.slice(0, 4)}…${value.slice(-2)} (len=${value.length})`;
}

function log(msg) {
  console.log(`[db:migrate] ${msg}`);
}

function warn(msg) {
  console.warn(`[db:migrate] WARN ${msg}`);
}

function fail(msg, code = 1) {
  console.error(`[db:migrate] ERROR ${msg}`);
  process.exit(code);
}

function resolveProjectRef() {
  const fromEnv = (process.env.SUPABASE_PROJECT_REF ?? "").trim();
  if (fromEnv) return fromEnv;
  const url = (process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim();
  if (!url) return "";
  try {
    return new URL(url).hostname.split(".")[0] || "";
  } catch {
    return "";
  }
}

async function listMigrationFiles() {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

async function assertNonDestructive(files) {
  const forbidden = [/\bDROP\s+TABLE\b/i, /\bTRUNCATE\b/i, /\bDROP\s+SCHEMA\b/i];
  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    for (const re of forbidden) {
      if (re.test(sql)) {
        fail(
          `${file} looks destructive (${re}). Refusing to apply. Run npm run db:plan.`,
        );
      }
    }
  }
  log("Preflight OK — no DROP TABLE / TRUNCATE / DROP SCHEMA detected");
}

async function applyViaPg(databaseUrl, files) {
  const { default: pg } = await import("pg");
  const { Client } = pg;

  let safeUrl = databaseUrl;
  try {
    const u = new URL(databaseUrl);
    if (u.password) u.password = "***";
    safeUrl = u.toString();
  } catch {
    safeUrl = "(unparseable DATABASE_URL)";
  }
  log(`Using DATABASE_URL → ${safeUrl}`);

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  log("Connected to Postgres");

  try {
    for (const file of files) {
      const full = path.join(MIGRATIONS_DIR, file);
      const sql = await readFile(full, "utf8");
      log(`Applying ${file} (${sql.length} chars)…`);
      try {
        await client.query(sql);
        log(`OK ${file}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (/already exists|duplicate/i.test(message)) {
          warn(`${file}: ${message} — continuing (idempotent)`);
          continue;
        }
        fail(`${file} failed: ${message}`);
      }
    }
  } finally {
    await client.end();
  }
}

async function applyViaManagementApi(token, projectRef, files) {
  const managementUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
  log(
    `Using SUPABASE_ACCESS_TOKEN → ${maskSecret(token)} against project ${projectRef}`,
  );

  for (const file of files) {
    const full = path.join(MIGRATIONS_DIR, file);
    const sql = await readFile(full, "utf8");
    log(`POSTing ${file} (${sql.length} chars)…`);

    const res = await fetch(managementUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const safeBody = body.replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer ***");
      if (/already exists|duplicate/i.test(safeBody)) {
        warn(`${file}: HTTP ${res.status} already-exists — continuing`);
        continue;
      }
      fail(`${file} failed: HTTP ${res.status} ${safeBody.slice(0, 500)}`);
    }

    log(`OK ${file}`);
  }
}

async function main() {
  const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
  const accessToken = (process.env.SUPABASE_ACCESS_TOKEN ?? "").trim();
  const forceApply = process.argv.includes("--force-apply");
  const dryRun =
    !forceApply ||
    process.argv.includes("--plan") ||
    process.argv.includes("--dry-run");

  const projectRef = resolveProjectRef();
  log(`Target project ref: ${projectRef || "(unset)"}`);
  log(`Wrong project (blocked): ${WRONG_REF}`);

  if (projectRef === WRONG_REF) {
    fail(
      `Refusing project ${WRONG_REF}. That is NOT opa-airjet-erp. Set VITE_SUPABASE_URL / SUPABASE_PROJECT_REF to the new project.`,
      2,
    );
  }

  const files = await listMigrationFiles();
  if (!files.length) {
    fail(`No .sql files found in ${MIGRATIONS_DIR}`);
  }
  log(`Found ${files.length} migration(s): ${files.join(", ")}`);
  await assertNonDestructive(files);

  if (dryRun) {
    log("Dry-run / default mode — no SQL executed.");
    log("Paste supabase/sql_editor/01_OPA_AIRJET_ERP_FULL_MIGRATION.sql into the CORRECT project's SQL Editor.");
    log("To apply from CI against the CORRECT project only: pass --force-apply with SUPABASE_PROJECT_REF set.");
    return;
  }

  if (!projectRef) {
    fail("Set SUPABASE_PROJECT_REF (or VITE_SUPABASE_URL) for the CORRECT opa-airjet-erp project");
  }

  if (!databaseUrl && !accessToken) {
    fail(
      "Set DATABASE_URL (supported pooler for CORRECT project) or SUPABASE_ACCESS_TOKEN before --force-apply",
    );
  }

  if (databaseUrl) {
    await applyViaPg(databaseUrl, files);
  } else {
    await applyViaManagementApi(accessToken, projectRef, files);
  }

  log("All migrations applied (or already present).");
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  fail(message.replace(/password=[^&\s]+/gi, "password=***"));
});
