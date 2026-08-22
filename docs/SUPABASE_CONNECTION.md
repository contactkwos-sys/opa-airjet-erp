# OPA Air Jet ERP — Supabase Connection Report

## CORRECT PROJECT (target)

| Field | Value |
|-------|-------|
| Project Name | **OPA AIR JET ERP** |
| Project slug | **opa-airjet-erp** |
| Project Reference | **UNVERIFIED** — waiting for `VITE_SUPABASE_URL` from the new project |
| Project URL | **UNVERIFIED** — must be `https://<new-ref>.supabase.co` for opa-airjet-erp |

## WRONG PROJECT (do not use / do not migrate)

| Field | Value |
|-------|-------|
| Project Reference | `ixulyhomqtajenigopai` |
| Project URL | `https://ixulyhomqtajenigopai.supabase.co` |
| Why wrong | Shared CRM / KWOS / Tantu project — **not** the new OPA production project |

**Status:** All previously injected service/publishable secrets decode to the **WRONG** project. No SQL has been (or will be) applied there from this correction.

## Frontend-safe credentials required

| Variable | Required |
|----------|----------|
| `VITE_SUPABASE_URL` | Yes — URL of **opa-airjet-erp** only |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes — publishable key of that same project |
| `VITE_SUPABASE_ANON_KEY` | Optional alias |
| `VITE_APP_BASE_URL` | Recommended |

## Never put in frontend

- `SUPABASE_SERVICE_ROLE_KEY`
- database password / `DATABASE_URL`
- WhatsApp access token
- CEO approval secret

## Migration apply method (correct project only)

1. Generate/validate locally: `npm run db:plan`
2. Paste **`supabase/sql_editor/01_OPA_AIRJET_ERP_FULL_MIGRATION.sql`** into the **OPA AIR JET ERP** Supabase **SQL Editor**
3. Do **not** claim applied until `opa_looms` / `visitor_requests` exist in that project

## Verification checklist (after correct secrets are provided)

1. URL host ≠ `ixulyhomqtajenigopai`
2. Project ref parsed from URL
3. `npm run supabase:test` (Auth + REST)
4. Emptiness probe (`opa_looms` missing before migrate)
5. SQL Editor apply on correct project only
