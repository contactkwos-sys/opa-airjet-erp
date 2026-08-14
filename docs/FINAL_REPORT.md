# OPA Air Jet Loom ERP — Final Report

Draft status for branch `cursor/opa-airjet-erp-complete-f556`.  
Project: **OPA Group of India — Air Jet Loom ERP** (72 looms: 36 Dobby + 36 Plain).

---

## 1. Existing modules (preserved)

| Area | Routes / pages | Notes |
|------|----------------|-------|
| Auth | `/login`, `AuthContext` | Demo Mode when anon key empty; SUPER_ADMIN preview |
| Shell | `AppShell` | Grouped nav; OPA branding CSS preserved |
| Executive | `/`, `/factory-floor` | Dashboard KPIs + Factory Floor |
| Looms | `/looms`, `/looms/:id` | Full CRUD + detail |
| Production entry | `/production` | Meter entry with loom map |
| Security architecture | `permissions.ts`, RLS migration, edge functions | Not removed |
| CEO mobile | `/ceo/visit/:token` | Token action surface |

---

## 2. New / deepened modules

| Module | Pages | Behavior |
|--------|-------|----------|
| Production | Planning, Targets, Stoppages | CRUD + zod validation + audit on create |
| Quality | Quality inspections | PASS/FAIL/HOLD/REWORK |
| Inventory | Inventory, Yarn, Beams, Greige, Spares | Masters + reorder fields |
| Purchase | Requisitions, PO, GRN, Suppliers | Doc status enums |
| Sales | Customers, Orders, Dispatch | Commercial docs |
| Maintenance | Requests, Work Orders, PM | Priority/status pipeline |
| HR | Employees, Attendance | Workforce + daily status |
| Finance | Accounts (AR/AP ageing), Costing, Receivables, Payables | Ageing buckets on Accounts |
| Security | Visitors, CEO Visits, Gate Pass, Vehicles, Material Gate, Incidents | CEO WhatsApp notify button |
| System | Reports (CSV), Notifications, Approvals, Documents, Search, Settings, Audit | Settings never stores WA secrets in browser |
| Executive | Daily Report, Alerts | Day summary + resolve alerts |

---

## 3. Key files added / updated

### Added
- `scripts/apply-migrations.mjs` — `DATABASE_URL` (pg) or `SUPABASE_ACCESS_TOKEN` (Management API)
- `src/lib/api.ts` — `listRows`, `getById`, `insertRow`, `updateRow`, soft helpers, `invokeEdgeFunction`, `downloadCsv`
- Nested pages under `src/pages/{production,quality,inventory,purchase,sales,hr,finance,system,executive,maintenance,security}/`
- `docs/FINAL_REPORT.md` (this file)

### Updated
- `src/components/ModulePage.tsx` — api helpers, permissions, validation, select/textarea
- `src/lib/demoData.ts` — `DEMO_BY_TABLE` / `getDemoRows`
- `src/lib/validation.ts` — module form schemas
- `src/components/layout/AppShell.tsx` — role-based nav filtering
- `src/App.tsx` — nested imports + `/accounts`
- `package.json` — `db:migrate`, `pg` / `@types/pg` devDependencies

---

## 4. Database tables (`opa_*`)

Migrations (lexicographic order):

1. `202608140001_opa_core.sql` — company, departments, shifts, profiles, permissions, audit, notifications, documents, approvals, alerts  
2. `202608140002_opa_production.sql` — looms, articles, plans, entries, targets, stoppages, quality  
3. `202608140003_opa_inventory.sql` — stores, items, yarn, beams, greige, spares  
4. `202608140004_opa_purchase_sales.sql` — suppliers, PR/PO/GRN, customers, SO, dispatch, payments, receipts, costing  
5. `202608140005_opa_maintenance_hr.sql` — maintenance, PM, employees, attendance  
6. `202608140006_opa_security.sql` — visitors, CEO visits, gate, vehicles, material gate, incidents, WhatsApp outbox  
7. `202608140007_opa_seed.sql` — company 72/36/36, shifts A/B/C, stores, looms, role permissions  
8. `202608140008_opa_rls.sql` — RLS helpers + policies + realtime publication  

**Apply status:** migrations are **pending apply** in this environment — neither `DATABASE_URL` nor `SUPABASE_ACCESS_TOKEN` was available. Frontend works in **Demo Mode** and falls back on missing tables (`PGRST205`).

```bash
# Direct Postgres
DATABASE_URL=postgres://... npm run db:migrate

# Or Supabase Management API
SUPABASE_ACCESS_TOKEN=sbp_... npm run db:migrate
```

Target project ref: `ixulyhomqtajenigopai`.

---

## 5. RLS summary

- Helper functions: `opa_current_role()`, `opa_is_elevated()`, `opa_has_permission(module, action)`
- Policies gate `SELECT/INSERT/UPDATE/DELETE` via role permissions for authenticated users
- Elevated roles (SUPER_ADMIN, CEO, DIRECTOR, FACTORY_MANAGER) get broader access
- Frontend never uses the service role key; Edge Functions use service role **server-side only**

---

## 6. Environment variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Frontend | Project URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Publishable/anon key only |
| `DATABASE_URL` | Migrate script | Direct SQL apply |
| `SUPABASE_ACCESS_TOKEN` | Migrate script | Management API SQL |
| `SUPABASE_URL` | Edge Functions | Runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Functions | Server writes (never in Vite) |
| `WHATSAPP_API_TOKEN` | Edge Functions | Meta/WhatsApp Cloud API |
| `WHATSAPP_PHONE_NUMBER_ID` | Edge Functions | Sender ID |
| `CEO_WHATSAPP_NUMBER` | Edge Functions | CEO destination |

Empty `VITE_SUPABASE_ANON_KEY` → Demo Mode.

---

## 7. WhatsApp CEO visit flow

1. Security creates `opa_ceo_visit_requests` (status `PENDING`)
2. UI button invokes Edge Function `whatsapp-notify` with `request_id`
3. Function (server secrets) updates visit, queues WhatsApp with approve/reject/reschedule links
4. `ceo-visit-action` Edge Function handles CEO response → status pipeline  
5. Settings UI shows WhatsApp toggles; secrets display as **“configured on server”**

---

## 8. Seed data

Idempotent seed (`007`):
- Company: OPA GROUP OF INDIA, 72 looms / 36 Dobby / 36 Plain, Asia/Kolkata, INR
- Shifts A/B/C
- Departments + stores (Yarn, Greige, Spare, General)
- 72 named looms
- Default role → module permissions
- PM checklist defaults

Frontend mirrors this via `demoData.ts` when DB is empty/unreachable.

---

## 9. Test results

| Check | Result |
|-------|--------|
| `npm run build` (`tsc -b && vite build`) | **PASS** |
| `npm run db:migrate` (no credentials) | Exits with clear error; no password leakage |
| Demo Mode UI | Modules load demo rows; create works locally |
| Live Supabase | Ready when anon key set **and** migrations applied |

---

## 10. Manual configuration remaining

1. Apply migrations (`npm run db:migrate` with `DATABASE_URL` or `SUPABASE_ACCESS_TOKEN`)
2. Set `VITE_SUPABASE_ANON_KEY` for live auth
3. Deploy Edge Functions `whatsapp-notify` and `ceo-visit-action`
4. Set WhatsApp + service role secrets in Supabase Function settings
5. Create first SUPER_ADMIN profile linked to `auth.users`
6. Confirm RLS by signing in as a non-admin role

---

## 11. Deployment notes

- Static SPA (Vite) — host `dist/` on any static CDN / Vercel / Netlify / Supabase hosting
- Do **not** embed service role or WhatsApp tokens in frontend env
- After schema apply, clear PostgREST schema cache if tables are not visible immediately
- Recommended smoke path: Login → Dashboard → Looms → Production → CEO Visits → WhatsApp notify (staging)

---

*Generated from repo state on 2026-08-14.*
