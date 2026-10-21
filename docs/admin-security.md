# Admin passkeys and recovery

Admin access requires the account password followed by a passkey or a single-use recovery code. Ordinary member sign-in is unchanged. Password confirmation expires after five minutes; verified admin access lasts 15 minutes and is bound to this browser's exact login session and the current account revocation version.

## Owner setup

1. Open the live site in Chrome, Edge or Safari and enter Admin.
2. Confirm your existing password, choose **Set up my passkey** and complete your own device prompt. Windows Hello, a supported phone/password manager or a security key can hold the passkey.
3. Save the eight recovery codes in a secure password manager or another protected location. The site shows the plaintext codes only once and stores only their SHA-256 hashes.
4. Choose **Verify passkey and continue**. Registration alone does not issue an admin confirmation.
5. In **Admin → Security**, add and test a second device. The system will not let you remove the last verified device while only untested replacements remain.

Your device controls its private key and fingerprint/face/PIN verification. Furlong stores the public credential, usage counter, optional device transport information and your device label. The app does not receive biometric data or the device's private key. Passkeys are scoped to the site's configured origin and domain; staging and production enroll separately.

## Recovery and changes

After confirming your password, choose **Use a recovery code instead** if your device is unavailable. Each code works once. Recovery revokes other sessions. Add and verify a replacement passkey, then remove a lost device and replace recovery codes if compromise is suspected.

Device changes and recovery-code replacement require both recent password confirmation and verified admin access. They revoke older sessions and recovery links. Rebinding a browser after these changes preserves the original password-confirmation deadline, rather than extending it indefinitely. Password reset by email does not remove the second factor.

If every device and every recovery code is lost, web administrators cannot bypass MFA or reset another admin's passkeys. Recovery requires an independently verified owner identity, a recorded recovery decision and a restricted database operator. Any emergency credential removal must also increment the account's session version and revoke authentication tokens. Never disclose credentials or recovery codes in a public issue or a support chat.

## Implementation and validation

The server uses SimpleWebAuthn with explicit origin/RP-ID checks and required authenticator user verification. Challenges are short-lived, bound to the logged-in browser session, and consumed atomically once. Credential counters and account authority are rechecked when committing. Synced passkeys whose counter remains zero are supported; reusing a consumed challenge is still rejected.

API mutations require an exact same-origin JSON request, authenticated admin role, a recent password grant, bounded bodies and shared database rate limits. Security changes and successful verifications create append-only audit entries containing no usable recovery codes. No mock or production bypass is included. Tests create ephemeral software authenticators and exercise actual signature verification; these are not personal device enrollments.

Other infrastructure audit items still apply: separate restricted runtime/database/deployment credentials, verify backup restoration, and protect GitHub, Cloudflare, email and wallet-custody accounts with their own MFA.
