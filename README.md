# OPA Group of India — Air Jet Loom ERP

Production ERP for **72 Air Jet Looms** (36 Dobby + 36 Plain), integrating production, inventory, purchase, maintenance, sales, HR, finance, reports, and the existing **Security + Visitor + CEO WhatsApp** module.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

Without Supabase credentials the app shows a configuration warning on the login screen and does not fabricate demo data.

## Login

- **Single login (`/login`):** pick Role (CEO, Director, Plant Manager, Production Manager, or Security) → pick Name (hidden when only one person) → enter personal 4-digit PIN. Validated by the `pin-login` Edge Function against bcrypt hashes — never checked in the frontend.
- **CEO / Director:** same `/login` page. After sign-in they can manage employees & PINs, view PIN history, unlock accounts, and copy **Employee Links** (personal `/login?role=…&e=…` URLs) to send via WhatsApp/SMS from phone or desktop. Default PINs: CEO `3501`, Director `3502`.
- **Employee deep links:** CEO/Director generate a unique shareable login link per employee (optionally with a one-time PIN) from **Employee & Roles**. Opening the link pre-selects that employee on `/login`.
- **Developer Override (hidden):** `/kwos-override` (alias `/dev-console`) — separate developer-only PIN for emergency reset, full ERP, and email recovery. Unchanged and separate from CEO/Director.
- **Admin tools:** Settings → Role PIN Management / history / locked accounts; `/admin/employee-overview` after CEO, Director, or Developer sign-in. Emergency Reset appears for Developer Override only.
- Legacy `/super-login` and `/admin` redirect to `/login`.

Apply migrations through `202608200300_ceo_director_unified_login.sql`, then deploy `supabase/functions/pin-login`.

## Environment

### Frontend (`VITE_*` only)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Publishable / anon key |
| `VITE_APP_BASE_URL` | Public app URL for links |

### Server-side (Edge Function secrets — never in frontend)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role |
| `WHATSAPP_API_URL` | Meta Graph API base |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | Phone number ID |
| `CEO_WHATSAPP_NUMBER` | CEO WhatsApp (e.g. `9198…`) |
| `CEO_APPROVAL_TOKEN_SECRET` | Signed approval link secret |
| `APP_BASE_URL` | Public ERP URL |

### Migrations

```bash
# Requires DATABASE_URL (IPv4 pooler) or SUPABASE_ACCESS_TOKEN
npm run db:migrate
```

Apply Security first, then ERP (`opa_*`) migrations under `supabase/migrations/`.

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run db:migrate` | Apply SQL migrations |
| `npm run test:security` | Security smoke tests |

## Docs

- `docs/SECURITY_MODULE.md` — Visitor / CEO WhatsApp / Gate Pass
- `docs/FINAL_REPORT.md` — Implementation report
