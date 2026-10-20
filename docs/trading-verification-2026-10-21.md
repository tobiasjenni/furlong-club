# Trading feature verification

## Scope and launch state

The change adds allocation bookkeeping and manual operator review, not trading execution or blockchain signing. The site's existing Harry copy is corrected to reflect the owner's confirmation that he is a real person; the current generated portrait remains identified as an illustration. A provisional 2–3% daily target is described as unverified and not guaranteed. Final terms are unfinished, so production application and database enrollment gates both remain closed. Existing manual deposits and membership purchases are independent of trading enrollment.

## Automated checks

- TypeScript validation passed.
- 128 tests passed across seven files. The 31 new trading cases execute the migrated PostgreSQL functions and cover the $500/$10,000 boundaries, cumulative cap, account eligibility, request replay conflicts, approval, exact 33-day duration, available/locked accounting, immutability, account closure, membership spending, rollback, early settlement rejection, actual results, zero return, partial/total loss, payout uniqueness, shared incoming/outgoing transaction claims and destination checksums.
- Production dependency audit: zero vulnerabilities. Existing build-only dependency advisories remain documented in the earlier release audit; this is not a claim that every dependency is advisory-free.
- GitHub CI applied every migration to PostgreSQL 16 and completed the production build. The separate staging workflow applied the same migration to the isolated Neon database and built/deployed the Cloudflare Worker.

## Hosted, separate-session database checks

Three independent Prisma Neon HTTP clients checked:

1. Nine simultaneous requests create one pending allocation per member.
2. Competing admins debit the same principal once and retain exactly 33 days between approval and unlock.
3. Allocation approval racing a membership purchase cannot overdraw available funds.
4. A simultaneous incoming deposit and outgoing payout cannot claim the same transaction/network. The losing operation rolls back completely.
5. Nine competing payout recordings create one completed payout and one financial posting.
6. Every cached available balance matches its journal, locked principal matches open allocation principal, and each five-account posting balances.

The private test helper initially attempted to read a PostgreSQL `void` return through Prisma. Casting the helper-only event result to text resolved that harness issue; the production functions were unaffected. All hosted checks then passed. Historical fixtures and fake transaction IDs are clearly labeled simulated and retained for auditability. No real cryptocurrency moved.

## Browser verification

The isolated member/admin accounts exercised a $500 USDC/Ethereum request, admin notification and approval. Available member credit changed from $541 to $41 only on approval. The saved deadline is exactly 33 days later, and early result/payout controls remain unavailable. A separate historical maturity fixture exercised a $25 simulated actual-result entry and a 525 USDC completed payout record, with no change to available credit. The five-account journal reconciled and the payout controls disappeared after completion. The new allocation’s lock was never overridden.

One page stream dropped during preview navigation and showed a connection-closed error. A reload restored the page. No financial action was pending or repeated during that navigation. This check does not constitute a load or availability guarantee.

## Remaining operational limits

Real enrollment must wait for finalized trading terms, final operator/strategy details and appropriate operational review. The software does not verify performance, reserves, solvency or legal authorization. An admin must independently verify every real deposit, actual result and external payout. Restricted database roles, backups/recovery, operator access protection and monitoring remain deployment responsibilities. Mistaken finalized results need an explicit compensating correction design; immutable records must not be edited to conceal errors. No email notification provider or automated payout service is connected.
