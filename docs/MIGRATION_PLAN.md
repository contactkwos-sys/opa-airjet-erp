# OPA Air Jet ERP — Database Migration Plan

## CORRECT vs WRONG

| | CORRECT | WRONG |
|--|---------|-------|
| Name | **OPA AIR JET ERP** / `opa-airjet-erp` | (shared) |
| Ref | *(from new project URL — verify before apply)* | `ixulyhomqtajenigopai` |
| URL | `https://<new-ref>.supabase.co` | `https://ixulyhomqtajenigopai.supabase.co` |

**Do not migrate the wrong project. Do not retry IPv6 direct DB connections against it.**

## Preferred apply method

Paste this single file into the **correct** project's Supabase SQL Editor:

```text
supabase/sql_editor/01_OPA_AIRJET_ERP_FULL_MIGRATION.sql
```

Individual ordered sources remain under `supabase/migrations/`.

## Safety guarantees

- All ERP tables use the `opa_*` prefix
- Security uses `visitor_*`, `ceo_visit_requests`, `vehicle_entries`, `material_gate_entries`, `security_*`
- No `DROP TABLE` / `TRUNCATE` / data `DELETE`
- Seed uses `ON CONFLICT DO NOTHING`
- RLS is role-based; `anon` is revoked on new tables

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

## Frontend vs server secrets

| Variable | Where | Notes |
|----------|-------|-------|
| `VITE_SUPABASE_URL` | Frontend | Must be **opa-airjet-erp** |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Frontend | Required |
| `VITE_SUPABASE_ANON_KEY` | Frontend | Optional alias |
| `VITE_APP_BASE_URL` | Frontend | Public app URL |
| Service role / DB password / WhatsApp / CEO secrets | Edge / Dashboard only | Never `VITE_*` |
