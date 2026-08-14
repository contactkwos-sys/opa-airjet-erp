#!/usr/bin/env node
/**
 * Print a non-destructive migration plan and conflict report.
 * Does not apply SQL. Safe to run without DATABASE_URL.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const PROJECT_REF = "ixulyhomqtajenigopai";
const PROJECT_URL = `https://${PROJECT_REF}.supabase.co`;

const FORBIDDEN = [
  /\bDROP\s+TABLE\b/i,
  /\bTRUNCATE\b/i,
  /\bDROP\s+SCHEMA\b/i,
  /\bDELETE\s+FROM\b/i,
];

const EXPECTED_OPA_PREFIX = "opa_";

async function main() {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  console.log("=== OPA Air Jet ERP — Migration Plan (non-destructive check) ===\n");
  console.log(`Project: ${PROJECT_URL}`);
  console.log(`Migrations: ${files.length}\n`);

  let blocking = 0;

  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const creates = [...sql.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_.]+)/gi)].map(
      (m) => m[1],
    );
    const alters = [...sql.matchAll(/ALTER\s+TABLE\s+([a-zA-Z0-9_.]+)/gi)].map((m) => m[1]);
    const drops = FORBIDDEN.filter((re) => re.test(sql)).map((re) => re.source);

    console.log(`• ${file}`);
    console.log(`  CREATE TABLE IF NOT EXISTS: ${creates.length ? creates.join(", ") : "(none)"}`);
    if (alters.length) {
      console.log(`  ALTER TABLE: ${[...new Set(alters)].join(", ")}`);
    }
    if (drops.length) {
      console.log(`  ⚠ Potentially destructive patterns: ${drops.join(" | ")}`);
      blocking += 1;
    } else {
      console.log("  Destructive DROP/TRUNCATE/DELETE: none detected");
    }
    console.log("");
  }

  console.log("Shared-DB coexistence rules:");
  console.log("  • ERP tables use prefix opa_*");
  console.log("  • Security uses visitor_*/ceo_*/security_* (not CRM profiles/audit_logs)");
  console.log("  • Existing CRM/KWOS/Tantu/family tables are left untouched");
  console.log(`  • Expected ERP table prefix: ${EXPECTED_OPA_PREFIX}`);
  console.log("");
  console.log("Apply when ready:");
  console.log("  DATABASE_URL=... npm run db:migrate");
  console.log("  # or SUPABASE_ACCESS_TOKEN=... npm run db:migrate");
  console.log("");

  if (blocking) {
    console.error(`Plan check FAILED: ${blocking} file(s) contain destructive patterns.`);
    process.exit(1);
  }
  console.log("Plan check OK — migrations are structured as non-destructive.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
