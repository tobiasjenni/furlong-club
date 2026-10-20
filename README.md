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
- Resend account and a verified sending domain (`EMAIL_PROVIDER=resend`)
- Bunny Stream library with token authentication on (`BUNNY_LIBRARY_ID`, `BUNNY_TOKEN_KEY`)
- `CRON_SECRET` set and the daily job scheduled
- Replace placeholder legal pages with reviewed text
