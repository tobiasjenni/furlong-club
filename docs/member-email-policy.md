# Member signup and temporary email confirmation pause

The owner requested a temporary pause while email delivery is finalized. Production and staging use `EMAIL_VERIFICATION_REQUIRED=false`. Signup skips verification token creation and delivery, issues the normal personal session, and opens the member dashboard. It never waits for a confirmation email. Existing unconfirmed members can also use ordinary member features.

Actual email ownership remains accurate: `User.emailVerifiedAt` stays null until a real verification or a Super Admin ownership review. Member pages display “Not required at the moment” during the pause. Admin promotion still requires confirmed ownership and a previous sign-in; admin MFA, suspension, wallet freezes, payment approval and accounting controls remain in force.

The deployment runs `scripts/configure-email-policy.mjs` after migrations and before publishing. It synchronizes the atomic database eligibility checks in `AuthPolicy` and records a policy change in the audit history. The database migration and application both default to requiring confirmation. The production audit checks that the Worker and database policies agree.

To restore confirmation after end-to-end email delivery is verified, set the Worker variable and deployment policy step to `true` in both deployment configurations and publish. Existing unconfirmed members will then need to confirm ownership before member payment/allocation actions. Never populate fake confirmation timestamps to bypass this policy.

Signup retains password confirmation, a 15-character minimum, server validation, rate limits, explicit age/terms consent, optional marketing opt-in, secure personal-session cookies and invitation enforcement. Reviewing terms opens a separate tab so the form stays available. Server errors receive focus; recovery forms preserve the entered email and show progress. Confirmation links opened in a fresh browser route through ordinary sign-in rather than a second invitation.

The requested disposable production email test created a zero-balance test account and successfully reached its dashboard. No incoming email was observed during the test; inbox delivery is not claimed as verified. That disposable account was subsequently closed. No funds were sent or credited.
