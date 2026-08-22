# SQL Editor migration pack

## Correct target

- **Project name:** OPA AIR JET ERP
- **Slug:** opa-airjet-erp
- Paste `01_OPA_AIRJET_ERP_FULL_MIGRATION.sql` into that project's **SQL Editor** only.

## Wrong project

- `ixulyhomqtajenigopai` — do **not** run any OPA migration here.

## Apply steps

1. Verify Dashboard project name is **OPA AIR JET ERP**.
2. Confirm Project URL host is **not** `ixulyhomqtajenigopai.supabase.co`.
3. Open **SQL Editor** → New query.
4. Paste the full contents of `01_OPA_AIRJET_ERP_FULL_MIGRATION.sql`.
5. Run once.
6. Verify tables exist (`opa_looms`, `visitor_requests`, etc.).

Do not claim migrations are applied until those tables are visible in the correct project.
