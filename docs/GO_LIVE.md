# OPA Air Jet ERP — Go Live Checklist

## Correct project only

| | |
|--|--|
| Project | **OPA AIR JET ERP** |
| Ref | `rjpwznapyaegotbswlke` |
| URL | `https://rjpwznapyaegotbswlke.supabase.co` |
| **Never use** | `ixulyhomqtajenigopai` / `test-client-only` |

## Already done in repo

- ERP + Security app code
- SQL migrations / SQL Editor packs (chunks 01–12)
- GitHub Pages deploy workflow
- Vercel SPA rewrites (`vercel.json`)
- Edge deploy script (refuses wrong project)

## You must do once (Dashboard)

### A) SQL — grants + first admin auto-profile

1. Open [SQL Editor](https://supabase.com/dashboard/project/rjpwznapyaegotbswlke/sql/new)
2. Paste **`supabase/sql_editor/chunk_12_grants_and_first_admin.sql`** → Run

### B) Create SUPER_ADMIN Auth user

1. Open [Auth Users](https://supabase.com/dashboard/project/rjpwznapyaegotbswlke/auth/users)
2. **Add user** → Create new user → email + password → **Auto Confirm User** ON
3. If profile did not auto-create, run `chunk_11_bootstrap_super_admin.sql` with that UID

### C) Auth URL config

After live URL is known (Pages or Vercel):

- Authentication → URL Configuration → **Site URL** = live app URL  
- Redirect URLs → add same URL (+ `http://localhost:5173` for local)

### D) GitHub Pages (free host)

1. Repo → **Settings → Pages → Source: GitHub Actions**
2. Repo → **Settings → Secrets → Actions** → add:
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = publishable key from OPA project
3. Push to `main` (or run workflow **Deploy OPA ERP to GitHub Pages**)
4. Live URL: `https://contactkwos-sys.github.io/opa-airjet-erp/`

### E) Optional — Vercel

```bash
npx vercel --prod
# set env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, VITE_APP_BASE_URL
```

### F) Optional — WhatsApp / CEO Edge Functions

Needs **OPA** project service role (not `ixulyhomqtajenigopai`) + `SUPABASE_ACCESS_TOKEN`:

```bash
export SUPABASE_ACCESS_TOKEN=...
export OPA_SUPABASE_SERVICE_ROLE_KEY=...   # from rjpwznapyaegotbswlke only
npm run deploy:edge
npx supabase secrets set --project-ref rjpwznapyaegotbswlke \
  WHATSAPP_API_URL=https://graph.facebook.com/v21.0 \
  WHATSAPP_ACCESS_TOKEN=... \
  WHATSAPP_PHONE_NUMBER_ID=... \
  CEO_WHATSAPP_NUMBER=91... \
  CEO_APPROVAL_TOKEN_SECRET=... \
  APP_BASE_URL=https://contactkwos-sys.github.io/opa-airjet-erp
```

## Smoke test after live

1. Open live URL → Login with SUPER_ADMIN  
2. Dashboard loads  
3. Looms / Production open  
4. Security visitor create (WhatsApp pending until F)
