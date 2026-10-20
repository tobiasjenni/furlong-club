# Furlong Club (working name)

Horse racing education and tip-video membership site. Next.js 15 + TypeScript + Tailwind, Postgres via Prisma.

## What's in v0.1
- Email sign-up and login, email verification, password reset, sign out on all devices, self-service account closure
- Member area: dashboard, video library gated by plan tier, account page with profile, password, subscription and payment history
- Plans: Paddock (free), Form Room ($29 / 30 days), Inner Circle ($79 / 30 days), editable in admin
- Crypto checkout in USDT/USDC (Tron, Ethereum, Polygon) behind a `PaymentProvider` interface
  - `mock` provider for local testing (a "simulate payment" button appears on the pay page)
  - `nowpayments` provider with signed IPN webhook at `/api/payments/webhook/nowpayments`
- Admin back office: stats, user search and filters, CRM notes and tags, role/suspend, grant or cancel access, payments list, video CRUD, plan editing, CSV export
- Wallet page with balance and history; deposit/withdraw are placeholders (disabled) until KYC and licensing are in place
- Rob is an illustrated mascot with a visible "fictional character" disclosure; 18+ and responsible gambling notices site-wide; no return claims

## Run locally
```bash
docker compose up -d          # local Postgres (or point DATABASE_URL at your own)
cp .env.example .env          # set AUTH_SECRET, admin email/password
npm install
npx prisma migrate deploy     # creates tables
npm run db:seed               # plans, sample videos, admin user
npm run dev                   # http://localhost:3000
npm test                      # unit tests
```
With `EMAIL_PROVIDER=console`, verification and reset links are printed in the server log.

## Security
- Passwords: bcrypt (cost 12), 10+ characters. Login takes the same time whether or not the email exists.
- Sessions: signed HttpOnly cookie carrying a session version. Changing or resetting a password, closing the account, or an admin suspending/demoting someone signs out all their devices.
- Email verification is required before paying. Reset and verification tokens are random, stored only as SHA-256 hashes, single use and short-lived.
- Rate limits on sign-up, login, password reset, verification emails and checkout. The limiter is in memory, so on serverless or multiple instances move it to Redis (e.g. Upstash).
- Payments: NOWPayments IPN signatures are checked (HMAC-SHA512, constant-time). A payment only unlocks a plan if the order id and price match our record and the full amount arrived; otherwise it is marked PARTIAL and logged. Confirmation is idempotent.
- The mock payment provider and its "simulate" button are disabled in production.
- Paid videos play through signed Bunny Stream links that expire after an hour.
- Headers: Content-Security-Policy, HSTS, frame-ancestors none, nosniff, Permissions-Policy. Admin video and thumbnail URLs must be https.
- Audit log of logins, failed logins, payments and every admin action (Admin → Audit log). CSV exports are protected against spreadsheet formula injection.
- `npm audit --omit=dev` is clean and runs in CI.

## Scheduled job
`GET /api/cron/daily` with `Authorization: Bearer $CRON_SECRET` sends renewal reminders three days before a plan ends, expires unpaid invoices and old tokens. `vercel.json` schedules it daily on Vercel.

## Going live checklist
- Postgres (Neon, Supabase, RDS) and hosting (Vercel or any Node host)
- `PAYMENT_PROVIDER=nowpayments` with API key and IPN secret; set `APP_URL` to the public URL
- Private video hosting (Vimeo private embeds, Bunny Stream or Mux signed URLs) so paid videos can't be shared
- Resend account and a verified sending domain (`RESEND_API_KEY`)
- Bunny Stream library with token authentication on (`BUNNY_LIBRARY_ID`, `BUNNY_TOKEN_KEY`)
- `CRON_SECRET` set and the daily job scheduled
- Replace placeholder legal pages with reviewed text

## Deploying to Cloudflare (furlong.club)
The app runs on Cloudflare Workers through the OpenNext adapter, with a Neon Postgres database reached over Neon's HTTP driver (`DATABASE_DRIVER=neon-http`). Every push to `main` runs `.github/workflows/deploy.yml`, which:
1. applies migrations,
2. seeds plans and the admin account (plans and videos are only created, never overwritten),
3. builds with `opennextjs-cloudflare`,
4. uploads Worker secrets,
5. deploys to `furlong.club` and `www.furlong.club`.

GitHub repository secrets (Settings → Secrets and variables → Actions):

| Secret | What it is |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | API token from the "Edit Cloudflare Workers" template, with the furlong.club zone included |
| `CLOUDFLARE_ACCOUNT_ID` | Shown on the Cloudflare dashboard overview |
| `DATABASE_URL` | Neon connection string (`postgresql://…neon.tech/…?sslmode=require`) |
| `AUTH_SECRET` | `openssl rand -base64 48` |
| `CRON_SECRET` | `openssl rand -hex 24` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | First admin login |
| `RESEND_API_KEY`, `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `BUNNY_TOKEN_KEY` | Optional, once those accounts exist |

Non-secret settings live in `wrangler.jsonc` under `vars`. While `PAYMENT_PROVIDER` is `mock`, a "Test mode" banner shows on every page and no real crypto moves. To go live with payments, switch it to `nowpayments`. Emails go out through Resend as soon as the `RESEND_API_KEY` secret exists. Until then, admins can confirm emails by hand and get invite and reset links to pass on themselves.

The Worker needs the Workers Paid plan ($5/month), because password hashing and the database engine use more CPU per request than the free plan's 10 ms allows. `.github/workflows/daily.yml` calls the daily job (renewal reminders, clean-up) every morning.

Local Workers preview: put `DATABASE_URL`, `DATABASE_DRIVER=neon-http` and `AUTH_SECRET` in `.dev.vars`, then run `npm run cf:preview`.
