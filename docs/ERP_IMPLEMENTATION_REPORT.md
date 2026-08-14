# OPA Air Jet ERP — Implementation Report (production deepen)

## CORRECT vs WRONG Supabase

| | Value |
|--|-------|
| **CORRECT project name** | OPA AIR JET ERP / `opa-airjet-erp` |
| **WRONG project (do not migrate)** | `ixulyhomqtajenigopai` |
| **Migration apply method** | Paste `supabase/sql_editor/01_OPA_AIRJET_ERP_FULL_MIGRATION.sql` into the **correct** project's SQL Editor |
| **Applied in this agent run?** | **NO** — not verified on opa-airjet-erp; secrets for correct project URL not confirmed |

## FILES CREATED

- `supabase/migrations/202608140009_opa_erp_extensions.sql`
- `src/lib/productionCalc.ts`
- `src/lib/loomCodes.ts`
- `src/lib/plantMetrics.ts`
- `src/pages/maintenance/BreakdownAnalyticsPage.tsx`
- `src/pages/system/RolesPage.tsx`
- `docs/ERP_IMPLEMENTATION_REPORT.md` (this file)
- Regenerated `supabase/sql_editor/01_OPA_AIRJET_ERP_FULL_MIGRATION.sql`

## FILES MODIFIED (high level)

- Dashboard, Looms, Loom Detail, Production Entry, Targets
- Inventory / Yarn / Beams pages
- Reports, Search, AppShell, App routes
- Types, permissions (ADMIN / VIEWER / PRODUCTION_HEAD / MAINTENANCE_ENGINEER)
- demoData loom codes → **D01–D36 / P01–P36**
- ModulePage (optional banner), CSS topbar/notifications
- package.json (`test` script), docs

## DATABASE TABLES / OBJECTS (additive)

Existing `opa_*` + Security tables retained. Migration 009 adds:

- Columns on `opa_looms` (`loom_code`, `production_capacity`, `department`, `operator_name`)
- Columns on `opa_production_entries` (shift/style/design/gsm/waste/…)
- `opa_company_settings.allow_negative_stock`
- View `opa_loom_master` (compatibility)
- Negative-stock triggers on inventory/yarn/spares
- Role enum values: ADMIN, VIEWER, PRODUCTION_HEAD, MAINTENANCE_ENGINEER
- Indexes; D01/P01 backfill + ensure 72 looms

**No DROP TABLE / TRUNCATE / DELETE of production data.**

## MIGRATIONS CREATED

1. `202608140009_opa_erp_extensions.sql` (new)
2. Full SQL Editor pack updated (files 000–009)

## EDGE FUNCTIONS CREATED

None new. Existing Security WhatsApp / CEO functions kept:

- `whatsapp-notify`
- `ceo-decision`
- `ceo-visit-action`

## ROUTES CREATED / WIRED

- `/maintenance/breakdown` — Breakdown analytics
- `/roles` — RBAC matrix
- Existing ERP + Security routes preserved

## FEATURES COMPLETED / DEEPENED

- Industrial ERP dashboard (fleet Dobby/Plain, production, stocks, purchase/GRN/maintenance/security cards + charts)
- Loom Master D01–D36 / P01–P36 with detail production history
- Production entry with auto calc + PDF/Excel/CSV
- Targets RAG dashboard
- Inventory low-stock banner; Yarn/Beam store fields
- Breakdown analytics
- Roles matrix (Security Guard cannot see purchase/accounts)
- Reports PDF/Excel/CSV
- Global search
- Header notification badge
- Security / Visitor / CEO WhatsApp modules **intact**

## TEST RESULTS

| Check | Result |
|-------|--------|
| `npm run lint` | PASS (warnings only) |
| `npm run test` / `test:security` | PASS (`SECURITY SMOKE OK`) |
| `npm run build` | PASS |
| `npm run db:plan` | Non-destructive structure (run locally) |
| Live SQL on opa-airjet-erp | **NOT APPLIED / NOT VERIFIED** |

## BUILD RESULT

`tsc -b && vite build` — **SUCCESS**

## BLOCKERS

1. Correct project `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` for **opa-airjet-erp** still required to verify Auth/REST/emptiness against the new project.
2. Schema must be applied via SQL Editor on the **correct** project (pack path above) — do not use `ixulyhomqtajenigopai`.
3. WhatsApp Edge secrets remain Dashboard/Edge-only (never `VITE_*`).
4. Some modules still use ModulePage CRUD shells for secondary workflows (sales/HR/finance); core plant modules above are production-deepened.

## REQUIRED FRONTEND ENV

```
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_APP_BASE_URL=
```

## SERVER / EDGE ONLY (never frontend)

```
SUPABASE_SERVICE_ROLE_KEY
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
CEO_WHATSAPP_NUMBER
CEO_APPROVAL_TOKEN_SECRET
APP_BASE_URL
```
