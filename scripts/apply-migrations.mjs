#!/usr/bin/env node
/**
 * Apply opa_* SQL migrations in lexicographic order.
 *
 * Auth (one of):
 *   DATABASE_URL            — direct Postgres connection (uses `pg`)
 *   SUPABASE_ACCESS_TOKEN   — Management API query endpoint
 *
 * Never prints connection passwords or tokens.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const PROJECT_REF = "ixulyhomqtajenigopai";
const MANAGEMENT_QUERY_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`;

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

async function listMigrationFiles() {
  const entries = await readdir(MIGRATIONS_DIR);
  return entries
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

async function applyViaPg(databaseUrl, files) {
  const { default: pg } = await import("pg");
  const { Client } = pg;

  // Redact password from logged URL
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
        // Idempotent migrations: treat "already exists" as success
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

async function applyViaManagementApi(token, files) {
  log(
    `Using SUPABASE_ACCESS_TOKEN → ${maskSecret(token)} against project ${PROJECT_REF}`,
  );

  for (const file of files) {
    const full = path.join(MIGRATIONS_DIR, file);
    const sql = await readFile(full, "utf8");
    log(`POSTing ${file} (${sql.length} chars)…`);

    const res = await fetch(MANAGEMENT_QUERY_URL, {
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

async function main() {
  const databaseUrl = (process.env.DATABASE_URL ?? "").trim();
  const accessToken = (process.env.SUPABASE_ACCESS_TOKEN ?? "").trim();
  const dryRun = process.argv.includes("--plan") || process.argv.includes("--dry-run");

  const files = await listMigrationFiles();
  if (!files.length) {
    fail(`No .sql files found in ${MIGRATIONS_DIR}`);
  }
  log(`Found ${files.length} migration(s): ${files.join(", ")}`);
  await assertNonDestructive(files);

  if (dryRun) {
    log("Dry-run only — no SQL executed. See also: npm run db:plan");
    return;
  }

  if (!databaseUrl && !accessToken) {
    fail(
      "Set DATABASE_URL or SUPABASE_ACCESS_TOKEN before running db:migrate (or pass --plan)",
    );
  }

  if (databaseUrl) {
    await applyViaPg(databaseUrl, files);
  } else {
    await applyViaManagementApi(accessToken, files);
  }

  log("All migrations applied (or already present).");
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  fail(message.replace(/password=[^&\s]+/gi, "password=***"));
});
