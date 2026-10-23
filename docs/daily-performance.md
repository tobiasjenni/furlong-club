# Daily club performance

Admin → Daily performance is the Super Admin entry point. Open a UTC date, enter its actual signed daily percentage, cite the supporting statement / correction reason, confirm the check and publish. A recorded 0% is break-even; a missing day stays unknown. Future daily results are rejected by both the server action and database.

The same shared club calendar appears on every member dashboard, Results & profit, account profile and admin CRM profile. Gains are green, losses red, and all entries include a signed percentage so color is not the only indicator. The selected month shows compound growth across its reported days and explicitly identifies incomplete history. The latest 33-day calendar window is summarized separately. Browse up to 13 calendar months; older daily records remain in the database and can be reviewed in Admin by selecting their date.

Compound growth is product(1 + daily return) − 1. Daily percentages are stored as integer basis points. +10% followed by −10% is −1%, not zero. Displayed totals round to two decimals. A full loss leaves the compounded value at zero. No blank day is automatically treated as a 0% trading result.

Each date has a revision. Publishing corrections, retracting or restoring a result requires the current revision, a supporting note and current Super Admin authority. Stale edits do not overwrite new data. Changes and their previous values are recorded atomically in the immutable audit log. Retraction hides a result from the member calendar without deleting its record. Staff Admins have read-only access.

## Owner-reported cycle summary

The owner supplied a 148% net profit figure for a 33-day cycle ending 25 October 2026, but supplied no actual daily breakdown. A separate Owner-reported summary displays that figure and date. It marks a future end date as still ahead and displays how many of its 33 daily figures have been supplied. It does not fabricate winning/losing days, claim the cycle has ended, or confirm any personal payout. When all 33 daily figures exist, the calendar checks whether their compounded return reconciles with the reported summary.

Super Admin can edit or hide this reported summary in Admin → Daily performance. Its date, source, revisions and visibility changes are audited. The 33-day window uses 33 inclusive UTC calendar dates ending on the supplied end date; actual allocation lock timestamps remain unchanged in their own records.

## Financial boundaries

These reported percentages do not credit wallets, change locked principal, revise an allocation's actual result or create a crypto payout. Personal allocation results and payout obligations remain in the existing financial ledger. A 148% net profit means principal plus 148% profit ($2,480 total on $1,000); 148% total returned would instead mean 48% profit.

Actual daily figures are still needed for the requested historical distribution. They cannot be reconstructed from a total return alone. No synthetic daily history is seeded into production.
