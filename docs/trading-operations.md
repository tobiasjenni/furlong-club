# Trading allocations: draft service and manual records

The owner confirms Harry Whitcombe is a real person. Site copy reflects that confirmation. The existing portrait is still an AI-generated illustration; no qualifications, verified performance or invented biography are claimed.

## Launch state

Real enrollment is **closed**. Both production `TRADING_REQUESTS_ENABLED=false` and the database `TradingProgram.enrollmentEnabled=false` prevent requests and approvals. There is no public or admin launch toggle. The isolated test deployment enables both gates for simulated funds. Existing obligations can still be settled if enrollment is later paused. The website does not execute trades, sign transactions, store private keys or send crypto.

The public proposal shows a $500–$10,000 range, a 33-day lock from admin approval, and owner-proposed, unverified **daily** targets of 1–3% for Form Room and 2–4% for Inner Circle. These are marketing proposals, not contractual rates, forecasts or verified historical performance. It does not guarantee returns or capital. No target earnings are accrued, compounded or credited. Final commercial terms, operator identity/contact details, strategy, fees, loss handling, compounding and jurisdiction-specific requirements must be defined before opening real enrollment. This document and the software are not a legal or investment compliance review.

## Member flow

1. An admin approves a real incoming deposit through the existing manual deposit flow. General manual deposits now accept 20–10,000 stablecoin tokens. A token is recorded as $1 of nominal USD credit, not a live market conversion.
2. Once enrollment is available, a verified member requests $500–$10,000 from available credit, chooses USDT/Tron, USDT/Ethereum or USDC/Ethereum, enters their external receiving address twice, and acknowledges the saved terms and risk. Checksummed Ethereum and Tron addresses are validated. The request does not reserve funds. Only one pending request is allowed per member.
3. An admin verifies the member, destination and terms, then approves or declines. Approval atomically checks the current available balance and a $10,000 limit across open allocations, moves principal from available credit to the locked account, and saves approval time and exactly 33 days later in UTC. Declining or cancelling a pending request does not move money.
4. Profile, dashboard and wallet show all open allocations, remaining time, approval and maturity dates, locked principal and payout status. Full paginated history is available at `/trading`. There is no early withdrawal.
5. At maturity, an admin enters the verified **actual net profit or loss**, with a member-visible note. Zero profit and losses down to the full principal are supported. Result records are immutable. A mistaken result requires a separately designed auditable correction; do not overwrite records or improvise a second payout.
6. The admin sends the exact amount due using their external wallet, in the saved token and network, to the saved address, paying outgoing network fees separately. After independently checking confirmation, token contract, amount, destination and network, the admin records the transaction ID and note. A transaction ID alone does not verify a payout. A verified total loss closes with no transaction and no payout.

The 33-day end is a lock deadline, not proof of payment or a promise that a transfer arrives at that moment. Principal stays recorded as locked/unpaid until settlement. Requests, terms, addresses, events and completed records remain visible after settlement. Suspending a member does not erase obligations; closing an account is blocked while any allocation remains open.

## Admin overview and controls

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
