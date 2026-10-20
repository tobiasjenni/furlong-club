# Furlong Club release audit — 21 October 2026

## Release scope

Repository-wide review of authentication, account recovery, authorization, member/admin pages, payment creation and callbacks, immutable accounting, subscription fulfilment, configuration, dependencies, database migrations, CI and deployment. Public routes and the deployed UI are verified separately after deployment. This is an engineering release audit, not an independent penetration test, legal review, or proof of on-chain reserves.

The website and wallet structure can be published. **Real-money acceptance is not ready:** production has no merchant API credentials or receiving addresses. The application therefore disables deposit creation and direct crypto checkout. Simulation remains available only in the separate staging environment, with an explicit simulated-money notice.

## Findings fixed

| Finding | Change and evidence |
| --- | --- |
| Production carried a test banner even though mock payments were disabled | Banner now requires the explicit staging simulation gate. Production uses NOWPayments, `APP_ENV=production` and `ENABLE_TEST_PAYMENTS=false`. |
| Repeated disclaimer boxes cluttered public/member pages | Removed page-level boxes. Footer information and legal pages remain. New logo is shared by header/footer and browser icon. |
| Auth token consumption and subscription expiry used unsupported Neon HTTP multi-update transactions | Replaced them with single-statement SQL. Token claim checks purpose, expiry and unused status atomically. Five new storage/rate-limit tests exercise the actual SQL in PostgreSQL-compatible PGlite. |
| Rate limits reset between Worker instances | Replaced in-memory counters with an atomic PostgreSQL upsert; identifiers are SHA-256 hashed. Cloudflare requests use the trusted connecting-IP header. |
| Admin pages relied on middleware/layout authorization | Every admin page now checks the current database-backed admin role before querying protected data. Actions and exports check authorization independently. |
| Account closure could race a credit or invoice | Closure and invoice insertion share the wallet's user-row lock and recheck account state. Closure blocks unresolved funds and increments the session version atomically. Regression test covers frozen/closed state. |
| Production email fallback logged usable account links | Production no longer logs email contents without a delivery provider. Recovery/verification show an honest support path; admins can retrieve manual links through protected tools. Changing an email atomically invalidates links to the previous address. |
| Long bcrypt passwords could silently truncate | New passwords must fit bcrypt's 72-byte input limit, including multibyte characters. |
| CSV formula protection missed leading whitespace | Export escapes leading control characters and whitespace-prefixed formulas; responses are private and not cached. |
| Dependency scan included critical build/test advisories | Updated Vitest and vulnerable transitive packages. Production dependency scan: zero known vulnerabilities. Full scan: five high entries, all from the single remaining `braces` build-time issue below. |
| Production deployment could run independently of checks | Deployment now runs TypeScript, tests and production dependency checks before migrations. It validates published routes, favicon, security policy and absence of test banners after deployment. Secret inventory failures stop deployment instead of silently rotating existing session keys. |
| Some copy contradicted wallet behavior or admin plan intervals | FAQ describes club credit accurately; plan extension labels use the configured period; payment-unavailable messages avoid setup details. |

## Accounting and security checks

- Balanced journal rows are enforced by PostgreSQL. Events and journal postings are append-only through database triggers; cached balances reconcile to journal sums.
- Duplicate callbacks and purchase retries cannot fulfil twice. Financial posting, cached balance, membership and audit record commit in one database statement.
- Provider HMAC authentication is followed by a fresh authenticated payment-status lookup. Identity, token/network, address, exact quote and USD invoice must match. Finished settlement requires a positive delivered amount and payout transaction hash.
- Partial/invalid payments do not become spendable credit. Late valid settlement remains creditable once. Reversals freeze spending for operator review; originals remain recorded.
- Session cookies are signed, HttpOnly, Secure in production and SameSite=Lax. Database status/session-version checks revoke access after suspension, password change or sign-out everywhere.
- All payment pages query ownership. Admin actions/export verify the current admin role. Secrets/private keys are not exposed to the browser.
- CSP, frame protection, HSTS, nosniff and restrictive browser permissions are configured. CSP still permits inline scripts required by the current Next.js rendering setup; nonce-based CSP is a future improvement.
- Prior separate-session hosted Neon tests verified competing credits, retry handling, purchase idempotency, insufficient-balance competition and ledger reconciliation. No real funds were used.

## Production inventory before release

Read-only audit: one user, one active admin, three active plans, six published video records, zero videos with sources, zero payments and zero nonzero/negative balances. Existing Worker secrets: database, session and cron credentials only. Seven sampled public routes returned HTTP 200. Production wallet/security migrations had not yet been applied.

## Remaining setup and limits

1. **Payments:** create/configure the NOWPayments merchant account, API key, IPN secret and club-owned receiving addresses. Verify the exact token variant, fees, minimums, payout override and returned transaction evidence in the provider sandbox. Perform an operator-approved small real payment and independent wallet check before general deposits. No merchant account, signing key or real receiving wallet was created by this release.
2. **Email:** connect Resend and verify the sending domain. Until then self-service email delivery/recovery is unavailable; admin-assisted confirmation and recovery remain possible.
3. **Videos:** upload real sources and configure protected video hosting. The existing six records have no media. This release does not supply video content.
4. **Build-only advisory:** `braces` 3.0.3 has no patched release in the installed Tailwind 3 dependency tree. Its stack-exhaustion advisory propagates to `chokidar`, `micromatch`, `fast-glob` and Tailwind (five high scan entries). The build uses repository-controlled patterns; customer requests do not reach this parser. Keep build inputs trusted and plan a separately tested Tailwind migration or patched upstream release. [Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
5. **Operations before holding funds:** establish backups/restore testing, reserve monitoring, an independently controlled receiving wallet, restricted runtime database credentials and a reconciliation/refund procedure. Provider-reported settlement is not an independent measurement of wallet reserves. The automatic reconciliation job scans recent payments in small batches; older disputes require admin reconciliation. Manual balance compensation requires a reviewed operational posting; no unrestricted credit/edit button is exposed.
6. **Legal/business:** existing terms/privacy text is brief template content. The business owner still needs to confirm operating identity, refund/credit terms, data retention and applicable requirements. This audit does not certify those matters.

## Validation record

- TypeScript check and 76 automated tests pass locally, including ledger, payment validation, session/signature checks, token storage, shared rate counters and closure.
- Production dependency audit: zero known vulnerabilities.
- Read-only production inventory and public-route checks passed through the existing GitHub/Cloudflare connection.
- Final CI, staging smoke checks and production publish results are recorded in the pull request and deployment workflow history.
