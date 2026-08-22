#!/usr/bin/env node
/**
 * Print a non-destructive migration plan and conflict report.
 * Does not apply SQL.
 */

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const MIGRATIONS_DIR = path.join(ROOT, "supabase", "migrations");
const WRONG_REF = "ixulyhomqtajenigopai";

const FORBIDDEN = [
  /\bDROP\s+TABLE\b/i,
  /\bTRUNCATE\b/i,
  /\bDROP\s+SCHEMA\b/i,
  /\bDELETE\s+FROM\b/i,
];

async function main() {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));

  console.log("=== OPA Air Jet ERP — Migration Plan (non-destructive check) ===\n");
  console.log("CORRECT TARGET: OPA AIR JET ERP / opa-airjet-erp (new production project)");
  console.log(`WRONG PROJECT (do not migrate): ${WRONG_REF}\n`);
  console.log(`Migrations: ${files.length}`);
  console.log("Apply method: Supabase SQL Editor (preferred) or CLI against the CORRECT project.\n");

  let blocking = 0;

  for (const file of files) {
    const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf8");
    const creates = [...sql.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-zA-Z0-9_.]+)/gi)].map(
      (m) => m[1],
    );
    const drops = FORBIDDEN.filter((re) => re.test(sql)).map((re) => re.source);

    console.log(`• ${file}`);
    console.log(`  CREATE TABLE IF NOT EXISTS: ${creates.length ? creates.join(", ") : "(none)"}`);
    if (drops.length) {
      console.log(`  ⚠ Potentially destructive patterns: ${drops.join(" | ")}`);
      blocking += 1;
    } else {
      console.log("  Destructive DROP/TRUNCATE/DELETE: none detected");
    }
    console.log("");
  }

  console.log("SQL Editor pack:");
  console.log("  supabase/sql_editor/01_OPA_AIRJET_ERP_FULL_MIGRATION.sql");
  console.log("");

  if (blocking) {
    console.error(`Plan check FAILED: ${blocking} file(s) contain destructive patterns.`);
    process.exit(1);
  }
  console.log("Plan check OK — migrations are structured as non-destructive.");
  console.log("NOT APPLIED — paste into the CORRECT project's SQL Editor only after verification.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
