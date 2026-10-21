# Furlong Club V2 member portal preview

V2 is available at `/v2` and becomes the default member dashboard after publication. It is an authenticated, noindex member workspace using the existing database, sessions, roles and financial functions. This branch does not enable real trading or introduce an automatic payout, compounding or daily-yield process. The owner approved the V2 design and requested production publication, including a matching public landing page.

## Reference review

The owner requested a review of the open StakerX Chrome app. The dashboard, stakes, calculator, transactions, referrals, wallet, results calendar, settings and support sections were inspected, along with deposit, withdrawal and new-stake dialogs. No wallet was connected, address generated, financial transaction executed, ticket submitted or account setting changed. Personal account details and referral identifiers are not copied into this repository.

The design uses common dashboard patterns from that review: sidebar navigation, an account-value panel, separate balance/earnings metrics, calendar-based result browsing, allocation cards and activity filtering. Furlong retains its own green/gold branding, logo, Harry profile, 33-day lock and manual review process. No StakerX assets, performance records, referral commission scheme or business promises are reused.

## Screens

- Overview: account value, available credit, committed principal, recorded profit/loss, payouts due, allocation cards, calendar and recent activity.
- Trading: paginated, member-scoped records with status/reference filters, lock progress and existing request/cancellation forms. Production enrollment remains closed.
- Results & profit: account/profit charts, 30/90/366-day views, an accessible data table, result calendar and date-filtered result records.
- Transactions: literal parameterized search, activity type filters, pagination, credit changes and separate result/external-payout amounts.
- Planner: a user-defined total-period scenario, approval-date illustration, 33-day maturity and funding shortfall. It does not forecast or write account records.
- Wallet: current and pending credit, enabled deposit networks, the existing deposit form, paginated receipts and manual reporting/cancellation.
- Membership: current plan, availability, plan comparison and the existing atomic club-credit purchase flow.
- Account: real profile, email/password forms, email ownership status, session revocation and guarded account closure.
- Support: process-specific questions and the real support email. No unconnected ticket system or wallet-signing prompt is presented.

## Accounting definitions

The overview is read in one PostgreSQL snapshot scoped to the authenticated member. Current value is available credit plus ACTIVE principal plus PAYOUT_READY total payout. PAYOUT_READY principal is not counted twice. Pending deposits and allocation requests are excluded from current value.

Recorded profit is the sum of actual net results with recorded result timestamps, including losses. It excludes deposits, membership payments, returned principal and targets. External payouts remove the total amount due from current value but preserve historical recorded profit. A zero-payout total loss closes the principal correctly.

The chart combines immutable journal movements with actual result and payout timestamps, groups by UTC day and carries balances forward. An opening aggregate preserves totals when history is longer than 366 days. Empty accounts have no fabricated history. If the chart endpoint does not reconcile with the current snapshot, the chart is replaced with a review message. Data is shown as daily close, not live market pricing or daily trading performance. Calendar blank days mean no allocation result was recorded.

## Access and operations

The middleware and V2 layout require the existing active session. Every data query uses the current member ID; query-string references and filters cannot select another member. Private metadata clears public canonical/sharing metadata, and responses carry noindex. Admin links are role-aware; existing server-side admin checks remain authoritative.

Existing financial functions still enforce balances, email verification, frozen wallets, immutable postings, term snapshots, approval rules, 33-day locks and payout deduplication. The only new action parameter chooses the V2 internal return route; the default classic routes remain unchanged. V2 refreshes every 30 seconds and financial mutations revalidate its layout.

The review environment uses simulated accounts and addresses. Do not send cryptocurrency to test addresses. Email delivery and video uploads still depend on operator configuration. No credentials or signing keys are stored in this document.

## Preview validation

TypeScript checks and all 186 automated tests pass. The analytics tests execute the actual PostgreSQL query and posting functions, including member isolation, pending funds, recorded unpaid results, external payouts, total losses, literal search and history beyond one year.

The hosted Cloudflare preview was reviewed across all nine member sections, membership checkout and member-owned deposit receipts. Browser checks covered chart metric/period controls and exact data, balance masking, calendar-to-result navigation, activity filtering and empty search results, hypothetical planner arithmetic, mobile navigation and an unsent simulated deposit creation/cancellation round trip. No transfer was reported or approved and no membership purchase or account security change was submitted. Responsive checks cover 320px and 390px phones, tablet and desktop layouts.

## Production publication

The public landing page and shared public styling now match the portal. The main header links to V2 wallet/account pages, and `/dashboard` forwards to V2 while preserving the legacy dashboard at `?classic=1`. Existing sign-in redirects continue to pass through the guarded dashboard route. The portal preview badge is removed. The simulated-money banner remains conditional on the isolated staging flags and never renders in production.

A read-only production audit confirmed manual deposits, all three owner receiving-wallet bindings, no mock payments, correct 33-day plans, and zero ledger balance/posting/locked-principal mismatches. Trading enrollment remains closed; this visual release does not enable it. No real payment, trading approval, credential change or account closure is performed during browser QA.
