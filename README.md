# Furlong Club (working name)

Horse racing education and tip-video membership site. Next.js 15 + TypeScript + Tailwind, Postgres via Prisma.

## What's in v0.1
- Email sign-up and login (18+ confirmation, bcrypt passwords, signed session cookie, rate-limited login)
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
cp .env.example .env          # set AUTH_SECRET, admin email/password
npm install
npx prisma db push            # creates tables in Postgres
npm run db:seed               # plans, sample videos, admin user
npm run dev                   # http://localhost:3000
```

## Going live checklist
- Postgres (Neon, Supabase, RDS) and hosting (Vercel or any Node host)
- `PAYMENT_PROVIDER=nowpayments` with API key and IPN secret; set `APP_URL` to the public URL
- Private video hosting (Vimeo private embeds, Bunny Stream or Mux signed URLs) so paid videos can't be shared
- Transactional email (verification, password reset, renewal reminders) is not built yet
- Replace placeholder legal pages with reviewed text
