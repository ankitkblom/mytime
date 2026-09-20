# Deploy: frontend on Vercel, backend + database on Render

```
Browser ──> Vercel (React UI) ──/api/*──> Render (Node API) ──> Render PostgreSQL
                                             └──> SMTP (login codes, review emails)
```
Vercel forwards `/api/*` to Render, so the browser only talks to **one domain**. That is what keeps the
secure `SameSite=Strict` login cookie working. Do not call the Render URL directly from the browser.

## 0. Put the code on GitHub
Push the contents of the `app/` folder as the repository root (do **not** include `Requirements/`).

## 1. Render (backend + database) — do this first
1. Render dashboard → **New → Blueprint** → pick the repo. It reads `render.yaml` and creates the Postgres database and the API.
2. When asked, fill the secrets: `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `APP_URL` (you can put a placeholder for `APP_URL` and correct it in step 3).
3. Wait for deploy. Open `https://<service>.onrender.com/healthz` → `{"ok":true}`.
4. Note the service URL. If the name `bloom-timesheet-api` was taken, Render gives a different URL.

## 2. Vercel (frontend)
1. Edit `client/vercel.json`: replace `https://bloom-timesheet-api.onrender.com` with **your** Render URL. Commit and push.
2. Vercel → **Add New → Project** → import the repo → **Root Directory: `client`** → Framework preset: Vite → Deploy.
3. Add your domain in Vercel → Settings → Domains (e.g. `timesheet.bloom-india.com`) and create the DNS record Vercel shows.

## 3. Connect them
In Render → service → Environment: set `APP_URL` to the final Vercel URL (used in email links), and save (it redeploys).

## 4. First login
Open your Vercel URL → **First time / forgot password?** → `ankit.kumar@bloom-india.com` → code arrives by email → set password → sign in.
Then Admin → add categories, projects, users.

## Email (SMTP)
Microsoft 365: `SMTP_HOST=smtp.office365.com`, port 587, sending mailbox must have Authenticated SMTP enabled (app password if MFA).
Alternatives: SES, SendGrid, Brevo, Mailgun. Ask IT for SPF + DKIM on the sending domain.
Test from Render → service → **Shell**: `npm run mail:test -- you@bloom-india.com`.

## Notes
- **Costs:** Render Starter web ≈ $7/mo + Postgres basic ≈ $6/mo; Vercel Hobby is free (for commercial use Vercel asks for the Pro plan).
- **Free tiers:** Render's free web service sleeps when idle and free Postgres expires after 30 days. Not suitable here.
- **Backups:** paid Render Postgres includes backups; check retention in the database's Recovery tab.
- **Rate limiting:** `TRUST_PROXY_HOPS=2` makes the API see the real user IP through Vercel → Render. If all users appear to share one limit (many "too many requests" errors), check this setting.
- Every push to the main branch redeploys both (schema changes apply automatically on start).
