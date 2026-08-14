# OPA Air Jet ERP — Supabase Connection Report

## Project

| Field | Value |
|-------|-------|
| App | opa-airjet-erp |
| Supabase ref | `ixulyhomqtajenigopai` |
| URL | `https://ixulyhomqtajenigopai.supabase.co` |

## Frontend configuration (safe)

| Variable | Required | Status |
|----------|----------|--------|
| `VITE_SUPABASE_URL` | Yes | Configured to project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supported (preferred) |
| `VITE_SUPABASE_ANON_KEY` | No | Optional alias for publishable key |
| `VITE_APP_BASE_URL` | Recommended | App public URL |

## Server / Edge only (never `VITE_*`)

| Variable | Required for |
|----------|--------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions / privileged ops |
| `DATABASE_URL` **or** `SUPABASE_ACCESS_TOKEN` | Applying SQL migrations |
| `WHATSAPP_API_URL` | CEO WhatsApp notify |
| `WHATSAPP_ACCESS_TOKEN` | CEO WhatsApp notify |
| `WHATSAPP_PHONE_NUMBER_ID` | CEO WhatsApp notify |
| `CEO_WHATSAPP_NUMBER` | CEO WhatsApp notify |
| `CEO_APPROVAL_TOKEN_SECRET` | Signed approval links |
| `APP_BASE_URL` | Approval / deep links |

Do **not** put service role, DB password, or WhatsApp tokens in frontend code.

## Tests run

| Check | Result |
|-------|--------|
| Auth health (`/auth/v1/health`) | PASS |
| Auth login endpoint (publishable key) | PASS |
| REST with publishable key | PASS (transport OK; `opa_*` tables pending migrate) |
| `npm run db:plan` non-destructive | PASS |
| `npm run db:migrate -- --plan` | PASS |
| `npm run test:security` | PASS |
| `npm run build` | PASS |
| Live SQL apply | **BLOCKED** — DB host IPv6-only; Supavisor pooler tenant not reachable from this agent without `DATABASE_URL` / `SUPABASE_ACCESS_TOKEN` |

## Shared database note

The linked Supabase project already contains CRM / KWOS / Tantu / family tables (`profiles`, `audit_logs`, etc.). ERP migrations are coexistence-safe:

- ERP → `opa_*` only
- Security → `visitor_*`, `ceo_*`, `security_*` (uses `security_audit_logs`, not CRM `audit_logs`)
- No `DROP TABLE` / `TRUNCATE` / data deletes

## Routes verified (present in router)

ERP: `/`, `/looms`, `/looms/:id`, `/factory-floor`, `/production`, `/planning`, `/targets`, `/stoppages`, `/quality`, inventory, purchase, sales, maintenance, HR, finance, reports, notifications, approvals, documents, search, settings, audit.

Security: `/security`, visitors, CEO visits, gate-pass, inside, history, vehicles, material-gate, incidents, reports, notifications, settings.

Auth / CEO: `/login`, `/security/login`, `/ceo/visit/:token`, `/ceo/approve/:token`.
