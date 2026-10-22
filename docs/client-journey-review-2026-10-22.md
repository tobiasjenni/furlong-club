# Client journey acceptance review — 22 October 2026

The review covers first invitation, free registration, return sign-in, member navigation, membership funding/purchase, manual deposits, allocation requests/cancellation/approval, recorded results, account settings, recovery, empty states and controlled error paths.

## Changes from the review

- Deposit, allocation, profile and email forms retain entered values after server errors. Important errors receive keyboard focus and submissions show specific progress.
- Membership funding keeps the chosen plan, suggests the missing credit within the existing deposit limits, and offers an explicit return to purchase. A deposit never automatically activates membership.
- Purchase and allocation intent keys stay stable during background refreshes. Existing atomic ledger operations still reject duplicate financial effects.
- Private links no longer speculatively preload every account screen/receipt. Database requests use fresh ten-second cancellation deadlines, no response caching, and no automatic retries of writes with uncertain outcomes.
- Video browsing keeps the member sidebar/mobile menu and returns restricted viewers to membership. Draft video titles are not exposed through member metadata.
- New free members get clear Trading with Harry and membership next steps. Wallet has an immediately visible Add funds action. Cancelled/declined requests explicitly show that no principal was locked.
- Mobile member form fields use 16px text. Account closure inputs have explicit labels. Copy failures offer manual selection/copying; password recovery offers direct support contact. Error screens do not falsely claim that a financial action could not have happened.

## Evidence collected during the review

- 322 automated tests and TypeScript passed locally. Required CI/build/security checks run on the final revision before merging.
- Baseline hosted checks passed for 48 member-route/access cases and 34 simulated funding/allocation cases.
- A deeper isolated acceptance sequence passed 81 checks across 52 page requests (slowest 1.633 seconds in that run). It exercised signup, every client section and rendered internal links, 29-dollar plan funding/purchase, duplicate purchase/request submissions, manual deposit reports/rejection, cancellation, exact 33-day lock, denied early settlement, profile persistence, rejected credential change and balanced journal postings.
- Browser navigation was exercised across wallet, memberships, trading, results, activity, planner, videos, account and help at 390px and 1440px. Those checks found no page-level horizontal overflow or unlabelled member form fields. The library navigation inconsistency found in that pass was corrected.
- The initial request burst exposed why private preloading is undesirable. Functional checks walk pages as a client would; separate bounded concurrent checks are recorded in the final local report.

## Practical limits

Financial tests use the isolated database, synthetic people and non-payable test addresses. They do not certify actual blockchain receipt, live trading or a real external payout. Production financial records are inspected read-only.

Email confirmation remains temporarily paused at the owner's request. Password hashing, session revocation, read-only Admin access, Super Admin approvals, verified staff ownership, wallet freezes and ledger controls remain in force. Inbox delivery is not certified; recovery retains the support fallback.

The library contains six preview titles and no playable sources in the reviewed environment. It accurately labels these as In preparation. Upload actual lessons before presenting video availability as ready.

The first browser pass encountered stalled test pages; the updated deployment was then walked successfully across all nine member destinations. This review improves tested paths; it is not a promise that every device, outage or external service can never fail.
