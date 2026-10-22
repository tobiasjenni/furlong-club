# Private club entrance and staff access

`CLUB_GATE_ENABLED=true` presents the London club door to signed-out visitors. The door offers member sign-in and an invitation password as two distinct choices. Existing members and staff use their own email/password without the invitation. `/login` renders the same door with member sign-in selected. Recovery and verification URLs remain available without an invitation. Signup independently checks invitation server-side, including when its action is posted to a public account-form URL.

The correct invitation grants this browser a two-hour guest visit, sufficient to explore the site and create an account. Guest admission is an HttpOnly, Secure, SameSite=Lax signed cookie with a separate JWT issuer/audience and the `guest-visit-v2` policy. Earlier year-long cookies are deliberately rejected. Historical `ClubAdmission` network fingerprints are retained but are no longer read or written by any entrance or signup path: sharing an IP never opens the door.

Personal sign-in replaces guest admission with the existing personal session and removes the guest cookie. Signing out, signing out everywhere, closing an account or completing a password reset clears both. Once a personal session expires or is revoked, the visitor returns to the door and can sign in again without an invitation. The existing fourteen-day personal session lifetime is unchanged. Active members skip the door; current account status and session version are checked before granting entry. Member-store failures refuse entry while leaving the door and sign-in/recovery forms available.

Invitation admission allows public browsing and signup; it never grants a personal account, wallet, staff access or approval authority. The password is rate-limited by a database counter (10 attempts per IP per 15 minutes), accepts only same-origin JSON, bounds input and checks a cost-12 bcrypt hash server-side. Set `CLUB_PASSWORD_HASH` as a Worker/GitHub secret. Keep the plaintext and hash out of client code, source files, logs and public documentation. Staging uses its own isolated secret. Rotating the invitation hash revokes guest cookies; changing `AUTH_SECRET` also revokes personal sessions.

The door preserves a safe local destination after login/invitation. Unsafe external URLs are rejected. Sign-in cannot redirect back into an entrance/auth loop. Personal and invitation forms show progress and errors independently; the shared invitation is excluded from password-manager autofill.

With the lock enabled, robots disallows the site, the sitemap is empty and HTML responses are noindex/no-store. Public artwork, icons and application code remain downloadable. Cron and webhook endpoints retain their independent authentication.

## Staff authority

- **Super Admin:** the protected owner account. Can approve/reject deposits, manage users/roles, review trading, record results/payouts and edit plans/videos. Other members cannot be promoted to Super Admin through the interface.
- **Admin:** read-only club/member records after password and second-factor confirmation. Cannot approve deposits or make back-office changes. Can manage their own passkeys and recovery codes.
- **Member:** their own account, deposits and allocation requests under existing ownership and balance rules.

Server actions check current authority. Atomic management/financial database functions independently recheck it. Role changes remain owner-only, audited, password-confirmed and restricted to verified active members who have signed in. The entrance does not replace any of these checks.

Validation covers invitation expiry/rotation/forgery and legacy-cookie rejection, no IP bypass, direct member sign-in, active/revoked/expired sessions, logout cleanup, recovery access, safe redirects, ordinary-member admin denial, rate limits, cross-origin requests, private APIs and protected server actions. Release probes check both door choices and locked routes without relying on a remembered network.
