# Wallet setup and operating guide

## Provider choice and cost

This implementation extends the app's existing NOWPayments integration. It does not require a separate custodial-wallet service, running blockchain nodes, storing private keys, or manually sweeping each customer's deposit address. NOWPayments collects each invoice and sends it to a configured external club wallet in the same token/network. New NOWPayments accounts may default to custody: configure external settlement and confirm that the payment API's `payout_address` override is honored before opening deposits.

Integration is free; transactions are not. Provider service fees, blockchain transfers and minimum payment amounts apply. Check the current [pricing](https://nowpayments.io/pricing) and the merchant dashboard rather than relying on a fixed percentage. The UI offers USDC on Polygon first, USDT on Tron next, with Ethereum alternatives. Only routes with configured receiving wallets are enabled. Availability is checked against the provider before creating each invoice. USD credit is the quoted invoice value; the club absorbs provider/settlement costs. The customer pays their sending wallet's network fee separately.

Useful provider references: [integration and status guide](https://nowpayments.io/blog/nowpayments-api-explained-customize-your-payment-gateway), [official payment API](https://documenter.getpostman.com/view/7907941/2s93JusNJt), [payout override parameters in the official client](https://github.com/NowPaymentsIO/nowpayments-api-php/blob/main/NowPaymentsAPI.class.php).

## Configure receiving wallets

1. Create the merchant account and arrange external-wallet settlement. Generate an API key and an IPN secret. Add/whitelist the club's public receiving addresses for the exact assets/networks selected. Confirm which Polygon USDC variant the provider's `usdcmatic` route uses; the receiving wallet must support that exact asset. Do not assume bridged USDC and native USDC are interchangeable.
2. Create a club-controlled receiving wallet supporting Polygon and/or Tron. Keep its recovery phrase and private keys outside this app and repository. One compatible wallet may hold several token balances; network and token accounting remain separate. Tron requires a different address from an EVM wallet.
3. Set `NOWPAYMENTS_API_KEY`, `NOWPAYMENTS_IPN_SECRET`, `APP_URL` (public HTTPS), and `PAYMENT_PROVIDER=nowpayments`. For testing use `NOWPAYMENTS_SANDBOX=true` and sandbox credentials/wallets. Never mix sandbox and mainnet configuration. Production defaults to the mainnet API; set the sandbox variable explicitly during sandbox deployment.
4. Set public receiving addresses as applicable:

   | Variable | Payment route |
   | --- | --- |
   | `POOL_WALLET_USDC_POLYGON` | USDC, Polygon (`usdcmatic`) |
   | `POOL_WALLET_USDT_TRC20` | USDT, Tron (`usdttrc20`) |
   | `POOL_WALLET_USDC_ERC20` | USDC, Ethereum (`usdc`) |
   | `POOL_WALLET_USDT_ERC20` | USDT, Ethereum (`usdterc20`) |

5. For Cloudflare, place API credentials and receiving addresses in the correspondingly named GitHub Actions secrets. The deploy workflow uploads them to the Worker. `PAYMENT_PROVIDER` and `WALLET_ENABLED` are deployment variables in `wrangler.jsonc`; set them to `nowpayments` and `true` only for the environment you intend to enable. Sandbox environments must use a separate database, URL and credentials.
6. Apply `npx prisma migrate deploy` before deploying the code. Back up the existing database first. Use Admin → Wallet & reconciliation to inspect readiness. Only public addresses go in address settings; the server never needs a signing key.
7. Verify provider notifications reach `/api/payments/webhook/nowpayments`. The URL is included with each new invoice. Configure IPN delivery/retries in the provider account as required. A notification arriving before the invoice response is persisted receives HTTP 503, allowing retry.

No merchant account or real receiving wallet is created automatically by this change. No funds are sent by the application until a customer uses a configured live payment invoice.

## Customer flow

The wallet's available amount is USD membership credit, not a claim to a displayed USDT/USDC token quantity. Top-ups are $20–$1,000 with two-decimal USD precision, subject to provider minimums. Each deposit has its own invoice/payment address; never instruct users to send directly to the pooled wallet. Direct pooled transfers cannot be attributed to a user by this implementation.

1. A verified, active user chooses an amount, token and network. The server creates a payment record and snapshots its pooled receiving address and membership terms where applicable.
2. The user receives the exact provider quote, network warning and one-time payment address/QR. The quote is denominated in tokens and can differ from the USD credit amount. Sending-wallet network fees must not be subtracted from the quoted amount.
3. A signed IPN is retained, then the server retrieves the payment from the authenticated provider API. Incoming `confirmed` and `sending` states are processing states; neither grants spendable credit.
4. `finished` must match the internal order ID, provider reference, USD price, token/network, quoted amount and payment address. Receipt must cover the entire quote (no tolerance). The saved external pooled address, matching outcome currency, positive outcome quantity and payout transaction hash are required. An echoed payout address must also match the saved address.
5. A single database operation records the event, payment status, balanced journal entry, balance and, for a direct crypto purchase, membership. Credits cannot appear without their journal entry. Wallet checkout locks the same member row, checks the current plan price and available credit, and atomically debits and grants access. Retrying a purchase key cannot charge twice.

The receipt page refreshes the database view every ten seconds. “Check payment status” explicitly queries the provider, is rate-limited, and enforces payment ownership. Withdrawals, gambling deposits, user-to-user transfers, browser-wallet signing and automatic currency trading are outside this membership-credit implementation.

## Internal records

- `Payment` ties the member and purpose to the invoice, exact quote, immutable-at-creation receiving-address snapshot, actual token receipt, deposit hash, net outcome amount/currency and pooled transfer hash. The latest mutable status is backed by permanent events.
- `PaymentEvent` retains original signed IPN JSON and normalized authenticated provider snapshots. Monetary JSON quantities are preserved without binary floating-point conversion; normalized quantities use exact decimal strings. Unique event keys deduplicate replayed notifications. Update/delete is blocked by database triggers.
- `WalletJournal` records one balanced USD posting per operation. Every row has member-credit, clearing and sales deltas summing to zero. Top-up: credit +X / clearing −X. Wallet purchase: credit −X / sales +X. Direct crypto purchase: clearing −X / sales +X, no member-credit change. Only journal insertion can change the cached `User.balanceCents`; direct edits are rejected. This operational ledger is not a full general-ledger accounting system or a blockchain balance indexer.
- Provider amounts are `DECIMAL(36,18)` and are kept separate by token/network. Gross less net outcome is displayed as the token settlement difference; it is not automatically converted into a USD expense. The provider-reported delivered totals are not the current on-chain pooled balance and cannot account for transfers made outside this system.
- Existing balances get explicit `OPENING` postings. Old payment rows are marked `LEGACY`; old confirmed payments are never credited/granted again. Their missing historical transfer evidence is not invented. Old unfinished invoices without a pooled-address snapshot require support review; use new invoices for new payments. Admin sales figures cover the new ledger only.
- Financial rows restrict deletion; closing or suspending an account preserves all financial evidence. Resolve remaining credit, review holds and pending deposits with support before self-service closure.

## Reconciliation and exceptions

The scheduled `Reconcile crypto payments` workflow queries up to 20 of the least-recently checked payments from the past 30 days every 15 minutes. It uses the existing `DATABASE_URL`, `NOWPAYMENTS_API_KEY`, and `NOWPAYMENTS_IPN_SECRET` repository secrets. GitHub schedules can be delayed and start only after the workflow is on the default branch. Webhooks remain the primary update path. Increase batch size/frequency for higher volume. Workflow failures are visible in Actions. Sandbox reconciliation needs `NOWPAYMENTS_SANDBOX=true` in that environment as well.

Alternatively schedule `GET /api/cron/payments` with `Authorization: Bearer <CRON_SECRET>` or run `npx tsx scripts/reconcile-payments.ts`. Use one scheduler. Admin → Payments → payment reference permits a fresh status check for any retained invoice, including older ones.

Admin → Wallet & reconciliation compares every cached member balance to its journal sum and displays flagged payments, token settlements and journal postings. Each payment drilldown shows the member, original receiving destination, incoming/outgoing hashes, monetary quantities, balanced posting and provider events. Investigate balance differences immediately. Compare hashes and net deposits with the independent receiving wallet or chain explorer; provider reports alone do not prove current reserves.

Partial payment, mismatched identity/token/network/price, missing settlement evidence, or an invalid destination cannot grant credit. All incoming notifications remain available. Underpaid invoices require provider/support handling; the UI does not invite a second full payment. Expiry is local display state: a later valid finished payment can still be credited once. Excess token payments are recorded as the actual received quantity, while only the quoted USD credit is issued; reconcile/refund excess through provider support, with an audited compensating posting if member credit must change. There is no automatic conversion of overpayments into additional credit.

Refund/failure reported after fulfillment preserves the original posting and freezes wallet spending for review. Do not delete or alter the original journal/event or manually edit the cached balance. An operator must reconcile the provider/chain outcome, account for already-spent credit and revoked membership where appropriate, then append an explicit balanced compensating journal and an audit record through a reviewed operational migration before clearing the hold. This release deliberately offers no one-click manual credit, reversal or release control.

The database functions provide one-statement transactions compatible with the deployed Neon HTTP adapter; they do not rely on unsupported interactive transactions. Use a restricted runtime database role and a separate migration owner in production. Keep backups, monitor webhook delivery and reconciliation failures, and retain records according to the business's retention policy. Database owners can always override triggers; the runtime app should not be an owner.

## Checks before opening payments

### Separate hosted test deployment

`.github/workflows/wallet-test.yml` deploys the `feat/stablecoin-wallet-ledger` branch as the separate `furlong-wallet-test` Worker. It uses the existing repository's Cloudflare account/token, plus `WALLET_TEST_DATABASE_URL`, `WALLET_TEST_MEMBER_PASSWORD`, and `WALLET_TEST_ADMIN_PASSWORD` secrets. The database must be a dedicated test database. This workflow never reads the production `DATABASE_URL` or NOWPayments credentials. It applies migrations to the test database and seeds verified fictional test accounts. The two passwords must be at least 20 characters. Do not put credentials in source files or workflow logs.

Staging simulation is gated by all of `APP_ENV=staging`, `ENABLE_TEST_PAYMENTS=true`, and `PAYMENT_PROVIDER=mock`; the production config does not set these test flags. The test site displays a permanent simulated-funds notice and disables indexing. All money in that environment is simulated. A generated test config fills in the account's actual `workers.dev` URL and is excluded from Git. Production deployments and receiving-wallet configuration remain independent.

If the Cloudflare secrets are stored in a protected GitHub environment instead of repository secrets, the test job needs access to that environment through its normal approval policy. Do not copy credentials into code or relax production branch protection to deploy a preview.

- Run `npm test`, `npm run lint`, and `npm run build`. Database tests execute both migrations and financial functions in PGlite. It has a single backend, so also run separate-session competing credits/spends against the target Postgres/Neon environment.
- In local development, set `WALLET_ENABLED=true`, `PAYMENT_PROVIDER=mock`, verify an account, create a top-up, simulate its completion, buy membership from balance, and inspect admin reconciliation. Mock payment addresses are visibly test-only, cannot be copied/scanned, and simulations are disabled in production even with the old override flag.
- In a separate provider sandbox, test each enabled token/network, minimum amounts, fees, payout-address overrides, the exact USDC variant and the returned transaction-hash fields. Missing evidence intentionally leaves the invoice for review.
- Replay notifications, send a partial payment, retry a purchase, delay a callback, and simulate an API outage. Check that no premature/double credit occurs and that retry/reconciliation restores the expected state.
- Configure real receiving wallets only after the sandbox passes; verify one small live end-to-end payment and its matching on-chain pooled receipt before opening general deposits.
