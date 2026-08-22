# OPA Air Jet ERP — Internal Audit Report

**Date:** 22 Aug 2026  
**Scope:** Full repository audit before industrial ERP UI conversion

---

## A. What is already working

| Area | Status | Notes |
|------|--------|-------|
| PIN login (`/login`) | Working | Edge Function `pin-login`, bcrypt hashes, lockout after 5 failures |
| ERP module CRUD | Working | 40+ pages via `listRows` / Supabase on `opa_*` tables |
| Dashboard KPIs | Mostly live | Fleet, production, inventory, alerts from Supabase |
| Factory Floor | Working | Live loom cards with status filters |
| Security module (`/security/*`) | Working | Visitor/CEO/gate workflows on security tables |
| PIN management RPCs | Working | `opa_set_role_pin`, employee PINs, audit history |
| RLS policies | Defined | `opa_has_permission()`, module-scoped in migrations |
| Build pipeline | PASS | `npm run build` succeeds |
| Responsive sidebar | Partial | Hamburger toggle exists at 860px |

---

## B. What is demo-only

| Item | Location |
|------|----------|
| Security local-store mode | `src/lib/localStore.ts`, `securityService.ts` |
| Security local login (no PIN) | `src/modules/security/LoginPage.tsx` |
| `DEMO_USERS` fallback | `src/lib/auth.tsx` when Supabase unconfigured |

**ERP main path does NOT fabricate demo KPIs** — shows empty/error states instead.

---

## C. What is connected to Supabase

All `opa_*` tables, `visitor_requests`, `ceo_visit_requests`, `visitor_entries`, PIN RPCs, Edge Functions (`pin-login`, `ceo-decision`, `whatsapp-notify`).

---

## D. What is using seeded/static data

| Item | Source |
|------|--------|
| 72 looms seed | `202608140007_opa_seed.sql` |
| Default role permissions | Seed migration |
| Default PIN hashes | `202608181200_opa_role_pins.sql` (must rotate in production) |
| Dashboard 7-day trend chart | **Synthetic** — scales today's actual, not historical |
| Shift fallback in Settings | Hardcoded A/B/C if no DB rows |

---

## E. What is incomplete

- CEO mobile page uses wrong table (`opa_ceo_visit_requests` vs `ceo_visit_requests`)
- `CeoApprovalPage` route param mismatch (`:token` vs `id`)
- Dead pages in `src/pages/security/` (not routed, wrong table names)
- SearchPage references `opa_visitors`, `opa_ceo_visit_requests` (non-existent)
- Frontend permissions static — not loaded from `opa_role_permissions` DB
- No per-route module guards (nav hides items but URLs reachable)
- Reports page is generic CSV export only — no PDF/Excel/print
- `reports`, `notifications`, `search` missing from DB permission seed

---

## F. What is duplicated

- Two auth stacks: `AuthContext` (ERP) vs `auth.tsx` (Security)
- Two profile tables: `opa_profiles` vs `profiles`
- Two permission systems: `permissions.ts` vs `roles.ts`
- Security UI: `src/modules/security/` (active) vs `src/pages/security/` (dead)

---

## G. What is confusing to users

- 10 nav groups with 50+ items visible when expanded
- Executive vs Production vs System overlap
- "Developer Override" label for SUPER_ADMIN
- Settings page mixes company config + PIN admin + emergency reset
- Dashboard shows 20+ KPI cards + charts + loom table — too much at once

---

## H. What is visually cluttered

- Decorative gradients on body and sidebar
- Large rounded cards (14px radius)
- Oversized KPI typography
- Multiple chart panels on dashboard
- brandPulse animation on logo

---

## I. What is unsafe

| Risk | Severity | Mitigation |
|------|----------|------------|
| Default PINs in migrations (7408, 3501, etc.) | High | Rotate on deploy; documented |
| `OPA_PIN_BOOTSTRAP_SECRET` fallback to service key prefix | Medium | Set env in production |
| CORS `*` on Edge Functions | Low | Restrict in production |
| `opa_pin_employee_directory` granted to anon | Low | Names only, no PINs |
| No route-level permission guards | Medium | Add ModuleGuard |
| Dual auth contexts | Medium | Unify in future sprint |

**No service role key or PINs in frontend source** — verified.

---

## J. What should be hidden from normal users

- Developer Override login (`/kwos-override`)
- Emergency PIN reset
- PIN change history / locked accounts
- Audit log (full)
- Employee Links & Roles admin
- RLS / system internals

---

## K. What should remain SUPER_ADMIN only

- Emergency PIN reset (`opa_emergency_reset_role_pin`)
- Developer Override route
- Full audit log access
- RLS status (future)
- System security settings

CEO/Director: PIN management for operational roles, employee overview.

---

## L. What needs final testing

1. All role logins (12 roles)
2. Wrong/correct PIN + lockout
3. Cross-module URL access blocking
4. iPad portrait/landscape layouts
5. Live Supabase data (BLOCKED without credentials in this environment)
6. WhatsApp Edge Function with secrets
7. RLS enforcement per role on each table

---

## Implementation priority (this sprint)

1. Industrial design system (CSS)
2. Collapsible nav with persistence
3. Top bar with LIVE status
4. Compact dashboard redesign
5. Factory floor enhancements
6. Security & Access Control page (PIN tabs)
7. Reports expansion
8. ModuleGuard route protection
9. Fix SearchPage table names
10. Remove demo labels from Security UI
