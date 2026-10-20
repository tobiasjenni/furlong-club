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
- Member wallet: USDT/USDC top-ups, USD credit balance, payment receipts and membership purchases from balance. Immutable balanced ledger and pooled settlement trail in admin. Manual funding uses configured receiving wallets and admin verification. General withdrawals and member-to-member transfers are not supported.
- Harry Whitcombe is the real host, as confirmed by the site owner. The current image remains labeled as an AI-generated illustration. Trading terms and daily targets are provisional; production enrollment remains closed.

See [trading operations](docs/trading-operations.md) for the draft $500–$10,000 allocation flow, 33-day locks, actual-result review and manual external payout records. Real trading enrollment remains closed.

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
- Passwords: bcrypt (cost 12), 10+ characters with an enforced 72-byte limit for new passwords. Login takes the same time whether or not the email exists.
- Sessions: signed HttpOnly cookie carrying a session version. Changing or resetting a password, closing the account, or an admin suspending/demoting someone signs out all their devices.
- Email verification is required before paying. Reset and verification tokens are random, stored only as SHA-256 hashes, single use and short-lived.
- Rate limits on sign-up, login, password reset, verification emails and checkout use shared, atomic PostgreSQL counters across serverless instances. Identifying keys are hashed; expired counters are cleaned daily.
- Payments: signed NOWPayments notifications trigger an authenticated status lookup. Order, price, token/network, address and exact amounts must match. Only `finished` with pooled transfer evidence fulfills an invoice. Event, balanced posting, balance and membership commit atomically; duplicates cannot double-credit or double-purchase.
- The mock payment provider and its "simulate" button are disabled in production unless the isolated staging deployment explicitly enables test payments.
- Paid videos play through signed Bunny Stream links that expire after an hour.
- Headers: Content-Security-Policy, HSTS, frame-ancestors none, nosniff, Permissions-Policy. Admin video and thumbnail URLs must be https.
- Audit log of logins, failed logins, payments and every admin action (Admin → Audit log). CSV exports are protected against spreadsheet formula injection.
- `npm audit --omit=dev` is clean and runs in CI.

## Scheduled job
`npm run daily` (or `GET /api/cron/daily` with `Authorization: Bearer $CRON_SECRET`) sends renewal reminders three days before a plan ends, expires unpaid invoices and old tokens. GitHub Actions runs it every morning.

## Going live checklist
- Postgres (Neon, Supabase, RDS) and hosting (Vercel or any Node host)
- Current manual deposits use `DEPOSIT_MODE=manual`, `WALLET_ENABLED=true` and configured receiving addresses. Optional automated deposits additionally need `PAYMENT_PROVIDER=nowpayments` with API/IPN credentials. Set `APP_URL` to the public URL.
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
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | First admin login |

`AUTH_SECRET` and `CRON_SECRET` are generated on the first deploy and kept on the Worker (add a GitHub secret with the same name to set them yourself).
| `RESEND_API_KEY`, `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `BUNNY_TOKEN_KEY` | Optional, once those accounts exist |

Non-secret settings live in `wrangler.jsonc` under `vars`. Production uses `DEPOSIT_MODE=manual` with simulations explicitly disabled: deposits go to configured public receiving addresses and credit only after admin verification. No payment-provider API key is required for manual deposits. Direct provider checkout is hidden in manual mode. The separate `wrangler.test.jsonc` deployment enables simulations only with all three settings: `APP_ENV=staging`, `ENABLE_TEST_PAYMENTS=true`, and `PAYMENT_PROVIDER=mock`. Complete [wallet setup](docs/wallet-setup.md) before accepting money. Emails go out through Resend as soon as the `RESEND_API_KEY` secret exists. Until then, admins can confirm emails by hand and get invite and reset links to pass on themselves. Production never logs usable verification or reset links.

The Worker needs the Workers Paid plan ($5/month), because password hashing and the database engine use more CPU per request than the free plan's 10 ms allows. `.github/workflows/daily.yml` runs `npm run daily` (renewal reminders, clean-up) every morning against the production database.

Local Workers preview: put `DATABASE_URL`, `DATABASE_DRIVER=neon-http` and `AUTH_SECRET` in `.dev.vars`, then run `npm run cf:preview`.

## Wallet and pooled payments

See [wallet setup and operating guide](docs/wallet-setup.md) for receiving-wallet configuration, accounting, fees, reconciliation, recovery and sandbox checks. The wallet migration preserves old displayed balances as explicit opening entries; it does not fabricate historical crypto settlement records. Admin sales statistics now use the new ledger and exclude pre-ledger sales.

`npm test` includes executable PostgreSQL migration/ledger checks in PGlite, exact-quantity/provider validation, duplicate and retry handling, partial payments, stale notifications, late deposits, refunds, and injected-failure rollback tests. PGlite uses one backend; separate-session concurrency still needs verification against the deployment's Postgres/Neon database before real funds.
