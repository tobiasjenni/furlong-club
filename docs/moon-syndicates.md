# Moon-calendar syndicates

The owner chose 00:00 UTC on each published entry date. This is an operational start time, not the astronomical phase instant. One full-moon and one new-moon entry are selected per UTC calendar month. The initial dates are 26 October 2026 (maturity 23 November) and 9 November 2026 (maturity 7 December).

The schedule is published through December 2027. Dates were checked against the [Royal Observatory of Belgium 2026 table](https://robinfo.oma.be/en/astro-info/moon/moon-phases-2026/) and [2027 table](https://robinfo.oma.be/en/astro-info/moon/moon-phases-2027/), converting Belgian local times to UTC dates. Where a month has an extra occurrence, only the selected first phase of each kind is an entry. August 2027's second new moon does not add a third entry. Extend the schedule in a reviewed migration before it runs out; no dates are extrapolated.

New requests save `lunar-v1-2026-10-23`, their immutable entry ID/start and 28-day maturity in the accepted terms. An old form cannot create a fresh 33-day allocation. Approval must finish before the selected start and rechecks availability, account status, funds and aggregate limits. No automatic rollover to another date is allowed without fresh consent.

Approval reserves capital immediately. `ACTIVE` includes both waiting-for-entry and trading-in-progress; the interface distinguishes these using `startsAt`. The exact 28-day trading period begins at the entry start. No second debit or cron transaction is needed at midnight. Results and payouts still enforce the saved maturity in PostgreSQL. Closing an entry stops new requests and approvals but does not cancel existing reservations.

Previously approved allocations retain their original timestamps, terms and ledger history. Existing 33-day allocations and the earlier owner-reported 33-day performance summary are not relabelled as 28-day history. Current rolling daily-performance windows use 28 days.

Internal `harry` database keys are stable legacy identifiers. Public names, profile routes, portrait, metadata and share imagery use Rob. Historical audit logs are not rewritten. Rob's biography does not inherit the former host's experience claims. The supplied photo is used without altering Rob's appearance; CSS frames him on the left.
