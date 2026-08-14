# OPA Group of India — Air Jet Loom ERP

Vite + React 19 + TypeScript frontend for the OPA air jet loom plant ERP. Uses the existing teal/steel industrial theme (Syne + Outfit) and connects to Supabase (`opa_*` tables).

## Features

- Auth with Supabase session + `opa_profiles` (role-aware permissions)
- **Demo Mode** when `VITE_SUPABASE_ANON_KEY` is empty — SUPER_ADMIN preview without remote auth
- Executive dashboard (fleet KPIs, production, charts, alerts)
- Full CRUD shells for **Looms** and **Production Entries**; factory floor board (72 looms)
- Module pages for materials, purchase, sales, maintenance, HR, finance, security, system
- Public CEO visit mobile route: `/ceo/visit/:token`
- Audit helper writing to `opa_audit_logs`

## Setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```
VITE_SUPABASE_URL=https://ixulyhomqtajenigopai.supabase.co
VITE_SUPABASE_ANON_KEY=your_publishable_or_anon_key
```

Use the **anon / publishable** key only. Never put the service role key in the frontend.

Leave `VITE_SUPABASE_ANON_KEY` empty to run in Demo Mode (local UI preview with mock fleet data).

## Develop

```bash
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Path alias

`@/` maps to `src/` (configured in `vite.config.ts` and `tsconfig.app.json`).

## Supabase

SQL migrations live under `supabase/migrations/`. Apply them to your project before connecting the app for live data.
