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

Without Supabase credentials the app runs in **Demo Mode** (ERP) / **local store** (Security).

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

- `docs/GO_LIVE.md` — **production deploy checklist**
- `docs/SUPABASE_CONNECTION.md` — CORRECT vs WRONG project
- `docs/MIGRATION_PLAN.md` — Migration order + SQL Editor pack
- `docs/SECURITY_MODULE.md` — Visitor / CEO WhatsApp / Gate Pass
- `docs/FINAL_REPORT.md` — Implementation report

## Production deploy

```bash
npm run build:pages   # GitHub Pages build
# or: npm run build   # Vercel / root-domain host
npm run deploy:edge   # Edge Functions (needs OPA service role + access token)
```

See `docs/GO_LIVE.md`.
