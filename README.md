# OPA Group of India — Air Jet Loom ERP

Production ERP for **72 Air Jet Looms** (36 Dobby + 36 Plain), integrating production, inventory, purchase, maintenance, sales, HR, finance, reports, and the existing **Security + Visitor + CEO WhatsApp** module.

## Quick start

```bash
npm install
cp .env.example .env
# Set VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY from project OPA AIR JET ERP
# Do NOT use ixulyhomqtajenigopai
npm run supabase:test
npm run dev
```

Without Supabase credentials the app shows a configuration warning on the login screen and does not fabricate demo data.

## Login

- **Single login (`/login`):** pick Role (CEO, Director, Plant Manager, Production Manager, or Security) → pick Name (hidden when only one person) → enter personal 4-digit PIN. Validated by the `pin-login` Edge Function against bcrypt hashes — never checked in the frontend.
- **CEO / Director:** same `/login` page. After sign-in they can manage employees & PINs, view PIN history, unlock accounts, and copy **Employee Links** (personal `/login?role=…&e=…` URLs) to send via WhatsApp/SMS from phone or desktop. Default PINs: **CEO `3501`**, **Director `3502`** (not 3051).
- **Employee deep links:** CEO/Director generate a unique shareable login link per employee (optionally with a one-time PIN) from **Employee & Roles**. Opening the link pre-selects that employee on `/login`.
- **Developer Override (hidden):** `/kwos-override` (alias `/dev-console`) — separate developer-only PIN for emergency reset, full ERP, and email recovery. Unchanged and separate from CEO/Director.
- **Admin tools:** Settings → Role PIN Management / history / locked accounts; `/admin/employee-overview` after CEO, Director, or Developer sign-in. Emergency Reset appears for Developer Override only.
- Legacy `/super-login` and `/admin` redirect to `/login`.

Apply migrations through `202608200400_ceo_pin_login_hardening.sql`, then deploy `supabase/functions/pin-login`.

## Environment

### Frontend (`VITE_*` only)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | URL of **opa-airjet-erp** (new production project) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Publishable key (preferred) |
| `VITE_SUPABASE_ANON_KEY` | Optional alias for the publishable key |
| `VITE_APP_BASE_URL` | Public app URL for links |

### Server-side (Edge Function secrets — never in frontend)

Service role, WhatsApp tokens, and CEO secrets belong only in Edge Function / Dashboard secrets — never in `VITE_*`.

### Migrations (SQL Editor — correct project only)

```bash
npm run db:plan   # non-destructive local validation (no writes)
```

Then paste:

`supabase/sql_editor/01_OPA_AIRJET_ERP_FULL_MIGRATION.sql`

into the **OPA AIR JET ERP** project's Supabase SQL Editor.

See `docs/MIGRATION_PLAN.md` and `docs/SUPABASE_CONNECTION.md`.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run db:plan` | Print/validate migration plan |
| `npm run db:migrate` | Preflight only by default (refuses wrong project) |
| `npm run supabase:test` | Auth + REST smoke test (refuses wrong project) |
| `npm run test:security` | Security smoke tests |

## Docs

- `docs/SUPABASE_CONNECTION.md` — CORRECT vs WRONG project
- `docs/MIGRATION_PLAN.md` — Migration order + SQL Editor pack
- `docs/SECURITY_MODULE.md` — Visitor / CEO WhatsApp / Gate Pass
- `docs/FINAL_REPORT.md` — Implementation report
