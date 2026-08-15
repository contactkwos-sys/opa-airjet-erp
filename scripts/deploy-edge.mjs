#!/usr/bin/env node
/**
 * Deploy Edge Functions to OPA AIR JET ERP only (rjpwznapyaegotbswlke).
 * Refuses wrong project service role (ixulyhomqtajenigopai).
 */
import { spawnSync } from "node:child_process";

const CORRECT = "rjpwznapyaegotbswlke";
const WRONG = "ixulyhomqtajenigopai";

function refFromJwt(key) {
  try {
    const payload = JSON.parse(Buffer.from(key.split(".")[1], "base64url").toString("utf8"));
    return payload.ref || null;
  } catch {
    return null;
  }
}

const serviceKey =
  process.env.OPA_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";

const accessToken = process.env.SUPABASE_ACCESS_TOKEN || "";
const projectRef = process.env.SUPABASE_PROJECT_REF || CORRECT;

if (projectRef === WRONG || projectRef.includes(WRONG)) {
  console.error("REFUSED: wrong project", projectRef);
  process.exit(1);
}

if (serviceKey) {
  const ref = refFromJwt(serviceKey);
  if (ref === WRONG) {
    console.error(
      "REFUSED: service role belongs to wrong project ixulyhomqtajenigopai. Set OPA_SUPABASE_SERVICE_ROLE_KEY from rjpwznapyaegotbswlke.",
    );
    process.exit(1);
  }
  if (ref && ref !== CORRECT) {
    console.error("REFUSED: service role ref", ref, "!==", CORRECT);
    process.exit(1);
  }
}

if (!accessToken) {
  console.error(
    "Missing SUPABASE_ACCESS_TOKEN (Dashboard → Account → Access Tokens).\n" +
      "Then: SUPABASE_ACCESS_TOKEN=... OPA_SUPABASE_SERVICE_ROLE_KEY=... npm run deploy:edge",
  );
  process.exit(1);
}

const fns = ["whatsapp-notify", "ceo-decision", "ceo-visit-action"];
for (const fn of fns) {
  console.log("Deploying", fn, "→", CORRECT);
  const r = spawnSync(
    "npx",
    ["supabase", "functions", "deploy", fn, "--project-ref", CORRECT],
    { stdio: "inherit", env: process.env },
  );
  if (r.status !== 0) process.exit(r.status || 1);
}
console.log("Edge functions deployed to", CORRECT);
