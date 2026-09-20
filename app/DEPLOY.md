# Deploying Bloom Timesheet

> Using **Vercel + Render**? See [DEPLOY-VERCEL-RENDER.md](DEPLOY-VERCEL-RENDER.md). This file covers the single-server Docker option.

Runs as three containers: **app** (API + UI), **db** (PostgreSQL 16, data in a Docker volume, not exposed publicly) and **caddy** (HTTPS certificates + reverse proxy).

## What you need
1. A Linux server (2 GB RAM is plenty) with Docker + Docker Compose, ports 80/443 open.
2. A domain, e.g. `timesheet.bloom-india.com`, with a DNS **A record** pointing to the server.
3. A mailbox/SMTP account that can send email (see “Email” below).

## Steps
```bash
git clone <your repo> /opt/bloom && cd /opt/bloom/app     # or copy the app/ folder
cp .env.example .env && nano .env                          # fill in every value
docker compose up -d --build
docker compose logs -f app                                 # expect "Bloom Timesheet on :4000 (production)"
```
Open `https://<DOMAIN>`. First admin = `ADMIN_EMAIL` (default `ankit.kumar@bloom-india.com`). It has no password yet:
click **First time / forgot password?**, enter that email, and set a password with the emailed code. Then add categories, projects and users under **Admin**.

Generate secrets with `openssl rand -hex 32`. Never commit `.env`.

## Email (login codes + review notifications)
Set `SMTP_*` in `.env`. Test before going live:
```bash
docker compose exec app npm run mail:test -- you@bloom-india.com
```
- **Microsoft 365** (Bloom uses SharePoint/OneDrive, so likely): `SMTP_HOST=smtp.office365.com`, port `587`. The sending mailbox needs **Authenticated SMTP enabled** (Exchange admin → mailbox → Manage email apps), and if MFA is on, use an app password. Some tenants have disabled SMTP AUTH; then ask your IT admin, or use one of the options below.
- Alternatives with plain SMTP: Amazon SES, SendGrid, Brevo, Mailgun, Postmark.
- Ask IT to publish **SPF + DKIM** for the sending domain so codes don't land in spam.

## Operations
| Task | Command |
|---|---|
| Update to a new version | `git pull && docker compose up -d --build` (schema migrates automatically) |
| Logs | `docker compose logs -f app` |
| Health check | `curl https://<DOMAIN>/healthz` |
| Backup now | `./deploy/backup.sh` (writes `backups/bloom-DATE.sql.gz`) |
| Daily backup | cron: `0 2 * * * cd /opt/bloom/app && ./deploy/backup.sh` — also copy `backups/` off the server |
| Restore | `gunzip -c backups/bloom-DATE.sql.gz \| docker compose exec -T db psql -U bloom bloom` |

## Security notes
- Only `@bloom-india.com` emails can sign in, and only users an admin has added. Password + emailed code (2FA); 5 wrong passwords lock the account 15 min; codes expire in 10 min.
- Session cookie is HttpOnly, SameSite=Strict, Secure (HTTPS only); HSTS and CSP headers are on.
- The app refuses to start in production without SMTP, a 32+ char `JWT_SECRET`, and `DATABASE_URL`.
- Keep the server patched; restrict SSH; the database port is intentionally not published.

## Managed database instead of the db container
Remove the `db` service from `docker-compose.yml`, and set `DATABASE_URL` on `app` to your provider's URL (append `?sslmode=require`). Backups then come from the provider.
