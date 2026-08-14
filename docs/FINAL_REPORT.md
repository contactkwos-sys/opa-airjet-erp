# OPA Group of India — Air Jet Loom ERP — Final Report

## 1. Existing modules detected

| Module | Source | Status |
|--------|--------|--------|
| Operations dashboard (fleet / production pulse / loom board) | Initial PR #1 | Preserved & extended into Executive Dashboard |
| **Security + Visitor Management** | PR #2 (merged) | **Reused intact** — UI, service, local store, Edge Functions |
| **CEO Visiting Request + WhatsApp** | PR #2 | **Reused** — `whatsapp-notify`, `ceo-decision`, mobile approval page |
| Gate Pass / Check-in / Check-out / Vehicles / Material Gate / Incidents | PR #2 | **Reused** under `/security/*` routes |
| Shared theme (Syne/Outfit, teal/steel sidebar) | PR #1 | Extended, not replaced |

## 2. New modules created

Executive Dashboard, Daily Report, Factory Floor (72 cards), Alerts, Loom Master + Detail, Production Entry/Planning/Targets/Stoppages, Quality, Yarn/Beams/Greige/Inventory/Spares, Purchase Requisitions/PO/GRN/Suppliers, Customers/Sales Orders/Dispatch, Maintenance Requests/Work Orders/PM, Employees/Attendance, Costing/Accounts/Receivables/Payables, Reports, Notifications, Approvals, Documents, Global Search, Settings, Audit Log, Role permissions, Demo Mode.

## 3. Files created (high level)

- `supabase/migrations/202608140001`–`008` (`opa_*` ERP schema, seed, RLS)
- `supabase/functions/ceo-visit-action/` (compat stub; primary flow uses `ceo-decision`)
- `scripts/apply-migrations.mjs`
- `src/context/AuthContext.tsx`, `src/lib/{api,env,permissions,validation,demoData}.ts`
- `src/components/layout/AppShell.tsx`, `src/components/ui/*`, `src/components/charts/*`
- `src/pages/**` ERP module pages
- `docs/FINAL_REPORT.md`

## 4. Files modified

- `src/App.tsx` — unified router (ERP + Security routes)
- `src/main.tsx` — nested Security + ERP auth providers
- `src/lib/supabase.ts`, `src/lib/audit.ts` — shared clients / dual audit writers
- `src/index.css` — ERP + Security styles merged
- `package.json`, `.env.example`, `README.md`, `.gitignore`

## 5. Database tables created (migrations pending apply)

`opa_*` tables for company settings, departments, shifts, profiles, role permissions, audit, notifications, documents, approvals, alerts, looms, articles, production plans/entries/targets, stoppages, quality, stores, inventory, yarn, beams, greige, spares, suppliers, purchase flow, customers, sales, dispatch, payments/receipts, costing, maintenance, PM, employees, attendance, WhatsApp outbox/webhooks.

## 6. Database tables reused (Security — do not duplicate)

`profiles`, `visitor_requests`, `ceo_visit_requests`, `visitor_entries`, `security_incidents`, `vehicle_entries`, `material_gate_entries`, `security_notifications`, `audit_logs` (from `20260814000000_security_visitor_module.sql`).

## 7. SQL migrations

1. `20260814000000_security_visitor_module.sql` (Security — already on main)
2. `202608140001_opa_core.sql` … `202608140008_opa_rls.sql` (ERP)

Apply with: `npm run db:migrate` (needs `DATABASE_URL` or `SUPABASE_ACCESS_TOKEN`).

## 8. RLS policies

- ERP: `opa_current_role()`, `opa_has_permission()`, module-scoped policies in `202608140008_opa_rls.sql`
- Security: policies inside `20260814000000_security_visitor_module.sql`
- Audit logs: insert/select for elevated roles; no update/delete for normal users

## 9. Edge Functions / API

| Function | Purpose |
|----------|---------|
| `whatsapp-notify` | CEO visit WhatsApp (Security — kept) |
| `ceo-decision` | Approve / Reject / Reschedule API + HTML (Security — kept) |
| `ceo-visit-action` | Alternate mobile action stub (compat) |

## 10. Environment variables

Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (preferred; `VITE_SUPABASE_ANON_KEY` alias), `VITE_APP_BASE_URL`  
Server: `SUPABASE_SERVICE_ROLE_KEY`, `WHATSAPP_*`, `CEO_WHATSAPP_NUMBER`, `CEO_APPROVAL_TOKEN_SECRET`, `APP_BASE_URL`  
Migrations: `DATABASE_URL` or `SUPABASE_ACCESS_TOKEN`

**Never place service role / WhatsApp tokens / DB password in frontend.**

## 11. WhatsApp configuration

Documented in `docs/SECURITY_MODULE.md`. If secrets missing, requests save with **WhatsApp Pending Configuration**.

## 12. Seed data

`202608140007_opa_seed.sql`: company OPA GROUP OF INDIA, departments, SHIFT A/B/C, stores, **72 looms** (01–36 DOBBY, 37–72 PLAIN) with `ON CONFLICT DO NOTHING`, default role permissions, PM checklist items.

## 13. Test results

| Check | Result |
|-------|--------|
| `npm run build` | PASS |
| `npm run test:security` | PASS (`SECURITY SMOKE OK`) |
| `npm run supabase:test` | PASS (Auth health + login endpoint + REST with publishable key) |
| `npm run db:plan` | PASS (non-destructive) |
| Live Supabase `opa_*` apply | **BLOCKED** — DB host IPv6-only / pooler tenant not reachable; needs `DATABASE_URL` or `SUPABASE_ACCESS_TOKEN` |
| Demo Mode ERP UI | Available without Supabase |
| Security local-store mode | Available without Supabase |

## 14. Errors / blockers

1. Previous agent run briefly pointed at wrong shared project `ixulyhomqtajenigopai` — **corrected**: that project must not receive OPA migrations.
2. Correct production project **OPA AIR JET ERP / opa-airjet-erp** Project URL + publishable key still required before Auth/REST verification and SQL Editor apply.
3. WhatsApp Edge secrets remain Dashboard/Edge-only — never frontend.

## 15. Manual configuration required

1. Enable Supavisor IPv4 pooler (or IPv4 add-on) and set `DATABASE_URL`, **or** add `SUPABASE_ACCESS_TOKEN`.
2. Run `npm run db:migrate`.
3. Deploy Edge Functions + set WhatsApp secrets (see Security docs).
4. Create ERP auth users / `opa_profiles` rows with roles.
5. Set `VITE_*` in hosting environment.

## 16. Deployment instructions

```bash
npm install
cp .env.example .env   # fill VITE_* only
npm run db:migrate     # once DB reachable
npx supabase functions deploy whatsapp-notify
npx supabase functions deploy ceo-decision
# set edge secrets…
npm run build
npm run preview        # or deploy dist/ to static host
```

Factory: **72 looms** configurable via Settings / `opa_company_settings.loom_count`.
