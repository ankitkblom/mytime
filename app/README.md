# Bloom Timesheet

Employee time tracking: fill 30‑minute slots (9:30 AM – 7:00 PM) per project, submit to a reviewer by email, reviewer approves/rejects, then day‑wise and month‑wise summaries (with CSV export).
Built from `Requirements/` (handwritten notes + `work Report.xlsx`).

**Stack:** Node/Express, PostgreSQL, React (Vite).

## Run locally (no Postgres install needed)
```
cd server && npm install && npm run dev      # embedded Postgres on :5433, API + seed on :4000
cd client && npm install && npm run dev      # UI on http://localhost:5173
```
Dev login: `ankit.kumar@bloom-india.com` / `ChangeMe-12345`. Locally the login code is shown on the sign-in screen (`DEV_SHOW_OTP`, never in production) and emails print in the server console.

## Production
See [DEPLOY.md](DEPLOY.md) (Docker Compose: app + PostgreSQL + HTTPS, SMTP email, backups).

## Behaviour
- **Access:** only `@bloom-india.com` emails, and only users an admin has added. Sign-in = password + 6‑digit emailed code (2FA). 5 bad passwords lock the account for 15 min.
- **New users:** admin adds them (Admin → users); they pick a password via “First time / forgot password?” (email code).
- **Timesheet:** for each slot pick a category, then a project code (only projects in that category are listed), write comments on what you did → Save → choose reviewer → Submit. Reviewer is emailed; sheet locks. Rejected sheets (comment required) are editable and resubmittable.
- **Approved** sheets are locked and show “Approved by X on <time>”.
- **Summary:** per‑day and per‑project totals for a month, approved-only toggle, CSV of the slot grid; admins can view any employee and a team table.
- **Admin:** manage users, departments (Technical › CS/OPR/O&M/Railways), projects (each under a category). Seeded from the spreadsheet (36 projects).

## Notes / assumptions
- Slots are 30 minutes per your notes and spreadsheet (your message said 1 hour; change `SLOT_COUNT`/`slots.js` if you really want hourly).
- Reviewer can be any active user except yourself.
- `server/test/flow.sh` is an end‑to‑end smoke test against the running dev server.
