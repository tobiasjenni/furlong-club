# Trading allocations: manual funding and records

Rob is the owner-confirmed trader. The site uses the supplied real photograph, framed on Rob on the left. No biography or experience claim from the previous host is transferred to Rob.

## Launch state

The owner requested opening manual allocation enrollment on 22 October 2026. Production now uses `TRADING_REQUESTS_ENABLED=true`. The separate database gate must also be open. Deployment enables that gate only after the updated Worker is published, through the owner-checked `trading_set_enrollment` function, with an append-only audit event. To pause new requests and approvals, deploy with both settings false; existing obligations can still be settled. Staging uses its own simulated funds and database.

New requests use `lunar-v1-2026-10-23` terms. A free account chooses a published entry and saves its phase, UTC start and 28-day maturity with the amount and payout destination. Older pending requests must be cancelled and resubmitted under current terms. Previously approved allocations retain their original snapshots and maturity dates. Subscriptions remain coming soon; purchases and renewal reminders are paused. Existing invoices may still reconcile transfers already sent.

The owner-proposed daily targets remain unverified and non-contractual. No target earnings are accrued, compounded or credited. Results use manually recorded actual net profit/loss. The website does not execute trades, sign transactions, store private keys, deduct a performance fee or send cryptocurrency. These software changes are not a legal, licensing, custody or investment compliance review.

## Member flow

1. The Super Admin approves a real incoming deposit through the existing manual deposit flow. General manual deposits now accept 20–10,000 stablecoin tokens. A token is recorded as $1 of nominal USD credit, not a live market conversion.
2. While enrollment is open, an active free member chooses a future moon entry and requests $500–$10,000 of available credit. Email verification is required only when enabled. The member chooses USDT/Tron, USDT/Ethereum or USDC/Ethereum, enters their external receiving address twice and accepts the saved entry dates, terms and risk. Pending requests do not reserve funds. Only one pending request is allowed per member.
3. The Super Admin verifies the member, destination and terms, then approves or declines before the selected start. Approval checks funds and the $10,000 open-allocation limit, and moves principal into reserved capital immediately. The trading period begins at the selected entry's 00:00 UTC start and ends exactly 28 days later. Reserved funds cannot be spent or withdrawn early. Declining or cancelling a pending request does not move money.
4. Profile, dashboard and wallet show all open allocations, remaining time, approval and maturity dates, locked principal and payout status. Full paginated history is available at `/allocations`. There is no early withdrawal.
5. At maturity, the Super Admin enters the verified **actual net profit or loss**, with a member-visible note. Zero profit and losses down to the full principal are supported. Result records are immutable. A mistaken result requires a separately designed auditable correction; do not overwrite records or improvise a second payout.
6. The Super Admin sends the exact amount due using their external wallet, in the saved token and network, to the saved address, paying outgoing network fees separately. After independently checking confirmation, token contract, amount, destination and network, the admin records the transaction ID and note. A transaction ID alone does not verify a payout. A verified total loss closes with no transaction and no payout.

The saved maturity is not proof of payment or a promise that a transfer arrives at that moment. Principal stays recorded as reserved/unpaid until settlement. Requests, terms, addresses, events and completed records remain visible. Suspending a member does not erase obligations; closure is blocked while any allocation remains open.

## Admin overview and controls

- `/admin/syndicates`: moon entries, UTC starts and maturities, per-entry pending requests and reserved capital. Super Admin can close or reopen future entries with revision checks and atomic audit. Dates and existing reservations cannot be silently changed.
- `/admin/trading`: all members, pending count/amount, locked principal, matured records, payouts due, completed payout totals, actual net member results and reconciliation. Filter by member, status or actions due; pages retain filters and expose every record.
- `/admin/trading/[id]`: member, amounts, destination, lock times, saved terms, review/result/payout notes, actor identities, on-chain reference, immutable event history and financial postings. Approval, actual-result and payout recording are separate actions with explicit verification.
- `/admin/users/[id]`: each member's open allocations and links to full history and controls.
- Every admin page has a notification count for pending requests and matured results or payouts, refreshed every 30 seconds while visible. No email notification service is connected.
- `/admin/wallet`: available credit, membership sales, locked principal, actual trading result offsets and all five journal accounts. Reconcile receiving wallets and outgoing payments independently; database totals are historical accounting records, not live wallet balances.

## Ledger and failure protection

All money-moving operations run in one PostgreSQL function call, including with Neon's HTTP driver. They lock member/admin rows in a consistent order, recheck current roles/status/freeze, and commit the state, financial posting and audit event together. Request keys and unique operations prevent repeat debits and payouts. Concurrent or stale approvals cannot overdraw spendable balances or exceed the allocation cap.

Journal legs are available member credit, locked principal, clearing, membership revenue and the actual trading result offset. Every posting sums to zero. Approval debits available credit and credits locked principal. Settlement removes locked principal, records the external payout and offsets actual profit/loss; it never creates membership revenue or a second available-credit payout.

A shared immutable chain-transfer registry prevents the same transaction hash/network being claimed by multiple payments or allocations, including simultaneous incoming deposit and outgoing payout records. This deliberately treats one transaction as one supported business record; batched transactions are not supported. Separate database tests and hosted multi-session checks cover rollback, retries and competing requests.

Balances, targets and a lock timer do not prove custody, trading performance, solvency or regulatory compliance. No real funds are used in automated or staging browser tests.
