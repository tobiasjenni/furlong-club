# Private club entrance and staff access

`CLUB_GATE_ENABLED=true` enables the shared invitation entrance before public pages, account pages, APIs and server actions. This does not authenticate a member or grant staff permissions. Members still use their individual login. The entrance is rate-limited by a shared database counter (10 attempts per IP per 15 minutes), accepts only same-origin JSON and checks a cost-12 bcrypt hash server-side.

Set `CLUB_PASSWORD_HASH` as a Worker secret and GitHub repository secret. Use a long randomly generated invitation passphrase; do not put the plaintext or hash in client code, source files, build logs or public documentation. Staging uses its own `WALLET_TEST_CLUB_PASSWORD_HASH`, injected as `CLUB_PASSWORD_HASH` in the isolated Worker.

The correct password permanently remembers the current public IP in `ClubAdmission`, until the invitation password or `AUTH_SECRET` changes. Only an HMAC-SHA256 fingerprint and admission timestamp are stored, never the raw IP. The fingerprint includes the current invitation hash, so rotating that hash revokes both remembered networks and cookies. IP addresses identify networks, not people: everyone behind the same Wi-Fi, VPN or shared public IP can enter after one successful admission; reassigned IPs inherit network admission until rotation. A changed public IP requires the password once again. Personal login and staff authorization remain mandatory.

An HttpOnly, Secure, SameSite=Lax signed cookie lasts 30 days and is bound to the network fingerprint. Valid cookies avoid a database lookup on ordinary visits. After cookie expiry, deletion or switching browsers, a remembered IP automatically receives a fresh cookie without entering the password. Database lookups/writes fail closed on errors; unknown/invalid IPs are never remembered as a shared fallback. Only Cloudflare's deployment-supplied `CF-Connecting-IP` is trusted, with IPv6 normalization and exclusion of private/invalid addresses, Worker subrequests and the shared cross-zone Worker address. Arbitrary forwarded headers cannot grant admission. If a trustworthy address is unavailable, only the browser's signed cookie is used, without permanent network admission.

Missing or malformed configuration fails closed. Set the replacement GitHub secret and deploy to rotate. The entrance has its own JWT issuer/audience and cannot be used as a login session. Changing `AUTH_SECRET` also revokes all member sessions. Old fingerprints are unusable after rotation and may be cleared from `ClubAdmission` by the operator. `/entrance?preview=1` displays the public entrance artwork even on an admitted network; it does not bypass the gate on any other route.

With the lock enabled, robots disallows the entire site, the sitemap is empty and HTML responses are noindex/no-store. Existing search listings may take time to disappear. Public artwork, icons and application code remain downloadable. Cron and payment webhook endpoints retain their own independent secret/signature authentication; they do not accept the shared entrance password as authorization.

## Staff authority

- **Super Admin:** the existing protected owner account. Can approve/reject deposits, manage users/roles, reconcile payments, review trading, record results/payouts and edit plans/videos. Elevating another member to Super Admin is not available in the interface or role-management function.
- **Admin:** read-only access to club/member records after password and second-factor confirmation. Cannot approve/reject deposits or make any back-office changes. Can manage their own passkeys and recovery codes.
- **Member:** manages their own account, deposits and allocation requests under existing ownership and balance rules.

Server actions check current Super Admin authority. Atomic database management/financial functions independently recheck it while holding account locks. Read-only UI hides review/edit controls; disabled fields alone are not the security boundary. Owner promotion/demotion controls remain audited, password-confirmed and restricted to verified active members who have already signed in.

Validation covers direct action calls, database denials, unchanged financial balances, cookie forgery/expiry/rotation, member authorization after admission, cross-origin requests, input limits, throttling and direct/RSC/server-action gate enforcement. Deployment probes check locked routes, crawler policy, entrance assets and independent cron authentication.
