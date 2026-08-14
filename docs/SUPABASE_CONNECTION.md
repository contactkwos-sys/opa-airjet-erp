# OPA Air Jet ERP — Supabase Connection Report

## CORRECT PROJECT (target)

| Field | Value |
|-------|-------|
| Project Name | **OPA AIR JET ERP** |
| Project slug | **opa-airjet-erp** |
| Project Reference | `rjpwznapyaegotbswlke` |
| Project URL | `https://rjpwznapyaegotbswlke.supabase.co` |

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

## Point 2 — Create SUPER_ADMIN (authorized user)

**Correct project only:** [OPA AIR JET ERP Auth Users](https://supabase.com/dashboard/project/rjpwznapyaegotbswlke/auth/users)

Do **not** create the admin on `test-client-only` or `ixulyhomqtajenigopai`.

### A) Make the Auth user (Supabase UI)

1. Open the link above (or Dashboard → project **OPA AIR JET ERP** → **Authentication** → **Users**).
2. Click green **Add user** → **Create new user**.
3. Enter email + password. Turn **Auto Confirm User** ON. Create.
4. Copy the **UID** from the Users table.

### B) Promote to SUPER_ADMIN (SQL Editor)

1. Left sidebar: **SQL** (or open [SQL Editor](https://supabase.com/dashboard/project/rjpwznapyaegotbswlke/sql/new)).
2. Paste `supabase/sql_editor/chunk_11_bootstrap_super_admin.sql`.
3. Replace `YOUR_AUTH_USER_UUID` and `your.email@domain.com`, then **Run**.

### C) Open the ERP Dashboard (app)

The Supabase “Users” page is **not** the ERP dashboard.

1. On your machine: ensure `.env` points at `https://rjpwznapyaegotbswlke.supabase.co`.
2. Run `npm run dev` and open the local URL (usually `http://localhost:5173`).
3. Go to **Login** (`/login`), sign in with the email/password from step A.
4. After success you land on the ERP **Dashboard** (`/`).

### Back to Supabase project home from Auth

In the top breadcrumb, click the project name **OPA AIR JET ERP**, or click the house / Home icon in the far-left icon rail.
