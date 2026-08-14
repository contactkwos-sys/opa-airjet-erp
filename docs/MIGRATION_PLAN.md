# OPA Air Jet ERP — Database Migration Plan

## Target project

| Field | Value |
|-------|-------|
| Name | opa-airjet-erp |
| Ref | `ixulyhomqtajenigopai` |
| URL | `https://ixulyhomqtajenigopai.supabase.co` |

## Safety guarantees

- All ERP tables use the `opa_*` prefix — **no duplicate** of Security / CRM tables.
- Security module uses `visitor_*`, `ceo_visit_requests`, `vehicle_entries`, `material_gate_entries`, `security_*`.
- Shared CRM tables (`profiles`, `audit_logs`, `notifications`, `approvals`, KWOS/Tantu/CRM) are **not** dropped, truncated, or rewritten.
- Migrations use `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, and idempotent `DROP POLICY IF EXISTS` / `CREATE POLICY`.
- Seed data uses `ON CONFLICT DO NOTHING`.
- RLS is role-based via `opa_profiles` / `opa_has_permission` — tables are **not** opened to `anon`.

## Ordered migrations

| # | File | Purpose |
|---|------|---------|
| 0 | `20260814000000_security_visitor_module.sql` | Visitor, CEO WhatsApp, gate, vehicles, material, incidents, security audit + RLS |
| 1 | `202608140001_opa_core.sql` | Company, departments, shifts, `opa_profiles`, permissions, audit, notifications, documents, approvals, alerts |
| 2 | `202608140002_opa_production.sql` | Loom Master, articles, production, targets, downtime/stoppages, quality |
| 3 | `202608140003_opa_inventory.sql` | Stores, inventory, yarn, beams, greige, spare parts |
| 4 | `202608140004_opa_purchase_sales.sql` | Suppliers, purchase, GRN, customers, sales orders, dispatch, costing, accounts |
| 5 | `202608140005_opa_maintenance_hr.sql` | Maintenance, PM, employees, attendance |
| 6 | `202608140006_opa_security.sql` | WhatsApp outbox helpers (does **not** duplicate Security tables) |
| 7 | `202608140007_opa_seed.sql` | Company, 72 looms, shifts, stores, role permissions (idempotent) |
| 8 | `202608140008_opa_rls.sql` | Role-based RLS for all `opa_*` tables |

## Module → table map

| Domain | Tables |
|--------|--------|
| Loom Master | `opa_looms` |
| Production / Target / Downtime / Quality | `opa_production_*`, `opa_loom_stoppages`, `opa_quality_*` |
| Yarn / Beam / Greige / Stores | `opa_yarn_*`, `opa_beams`, `opa_greige_*`, `opa_stores`, `opa_inventory_*` |
| Purchase / Supplier / GRN | `opa_purchase_*`, `opa_suppliers`, `opa_grns` |
| Maintenance / PM / Spares | `opa_maintenance_*`, `opa_pm_*`, `opa_spare_parts` |
| Employee / Attendance | `opa_employees`, `opa_attendance` |
| Sales / Customer / Dispatch | `opa_sales_*`, `opa_customers`, `opa_dispatches` |
| Costing / Accounts | `opa_costing_entries`, `opa_payments`, `opa_receipts` |
| Security / Visitor / CEO / Gate | Security migration tables above |
| Notifications / Approvals / Audit / Reports | `opa_notifications`, `opa_approvals`, `opa_audit_logs` (+ app report views) |

## Apply prerequisites

Provide **one** of:

1. `DATABASE_URL` — IPv4 Session/Transaction pooler URI  
2. `SUPABASE_ACCESS_TOKEN` — Management API personal access token  

Then:

```bash
npm run db:plan      # review plan (no writes)
npm run db:migrate   # apply in order
npm run supabase:test
```

## Frontend vs server secrets

| Variable | Where | Notes |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | Frontend | Required |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Required (preferred) |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Optional alias for publishable key |
| `VITE_APP_BASE_URL` | Frontend | Public app URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge / CI only | Never `VITE_*` |
| `SUPABASE_DB_PASSWORD` / `DATABASE_URL` | CI / migrate only | Never frontend |
| `WHATSAPP_*`, `CEO_*` | Edge Function secrets | Never frontend |
