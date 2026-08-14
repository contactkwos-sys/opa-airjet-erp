# Security + Visitor Management Module

Complete Security, Visitor, CEO Visiting Request, WhatsApp notification, Gate Pass, Vehicle, Material Gate and Incident Management for **OPA Group of India — Air Jet Loom ERP**.

## Quick start

```bash
npm install
cp .env.example .env   # optional until Supabase is ready
npm run dev
```

Without Supabase credentials the module runs in **local browser store mode** so the full Security → CEO → Check-in → Exit flow can be tested with real form data (not fake visitor stats).

## Environment variables

### Frontend (Vite)

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Public anon key |
| `VITE_APP_BASE_URL` | Public app URL used in links |

### Server-side only (Supabase Edge Function secrets)

| Variable | Purpose |
|----------|---------|
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (never in frontend) |
| `WHATSAPP_API_URL` | e.g. `https://graph.facebook.com/v21.0` |
| `WHATSAPP_ACCESS_TOKEN` | Meta WhatsApp Cloud API token |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp phone number ID |
| `CEO_WHATSAPP_NUMBER` | CEO number, e.g. `9198XXXXXXXX` |
| `CEO_APPROVAL_TOKEN_SECRET` | Long random secret for signed links |
| `APP_BASE_URL` | Public ERP URL for approval links |

If WhatsApp is not configured: visitor/CEO requests still save and show **WhatsApp Pending Configuration**.

## Database

Apply:

```
supabase/migrations/20260814000000_security_visitor_module.sql
```

Then deploy functions:

```bash
supabase functions deploy whatsapp-notify
supabase functions deploy ceo-decision
supabase secrets set WHATSAPP_API_URL=... WHATSAPP_ACCESS_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... CEO_WHATSAPP_NUMBER=... CEO_APPROVAL_TOKEN_SECRET=... APP_BASE_URL=...
```

## Roles

`SUPER_ADMIN`, `CEO`, `DIRECTOR`, `SECURITY_HEAD`, `SECURITY_GUARD`, `FACTORY_MANAGER`

CEO can decide visiting requests but does not automatically receive inventory/purchase/production/maintenance access.

## Test CEO WhatsApp approval

1. Configure Edge secrets and deploy `whatsapp-notify` + `ceo-decision`.
2. Sign in as Security Head/Guard → Visitor Requests → **Request Meeting with CEO**.
3. CEO receives WhatsApp with Approve / Reject / Reschedule links.
4. Open link on phone → decide (signed token, expires in 48h, one-time).
5. Security dashboard/notifications update (Realtime when Supabase enabled).

Local without WhatsApp: after creating a CEO request, open the **Mobile link** from CEO Visiting Requests.

## End-to-end checklist

Security login → Create visitor (CEO) → Save → WhatsApp (or pending config) → CEO approve → Security notified → Search & ID verify → Check-in → Gate pass → Inside → Check-out → Duration → Reports.
