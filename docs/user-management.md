# User management and owner access

The configured owner is the sole Super Admin. Staff Admin accounts have read-only CRM and financial access. Members create their own accounts and accept age, terms and marketing declarations themselves.

## Edit, suspend or restore a member

Open Admin → Users & CRM, search for the member and choose Manage account. Edit member profile changes their name, country, tags and account status. Every edit needs a reason and records the previous and new values. A stale form cannot overwrite a newer account update: refresh and review again. Sign-in email, consent, wallet balances and role are not editable through this form.

Suspended accounts cannot sign in. Active restores a suspended or deleted / closed account without renewing expired or cancelled memberships. Status changes revoke all sessions and outstanding email/recovery links. Name, country and tag changes alone do not sign the member out.

## Delete an account

Only Super Admin can expand Review account deletion, type the target email, provide a reason and enter the current Super Admin password. The database rechecks the owner's current role, active status and password hash under row locks before closing access. The owner cannot delete or change their own account through CRM controls.

Deletion is a reversible account closure, not physical removal or personal-data erasure. It blocks sign-in and token issuance, revokes sessions and recovery/verification links, disables marketing consent and stamps the closure date. Email remains reserved. Payment, trading, journal, CRM and audit records are retained. Find these accounts using the Closed filter; choose Active in their profile to restore access.

Closure is blocked while available credit is nonzero, the wallet is frozen, a payment is pending/confirming/partial, a legacy ledger request is pending, a trading allocation is pending/active/awaiting payout, or an unexpired paid membership is active. Resolve those obligations first; do not discard them to remove a member. Cancelled/expired membership records and settled financial history remain stored.

## Appoint an admin

Open the registered member's profile. Confirm email ownership if needed, recording how it was checked. Promotion requires an active account, confirmed email and prior sign-in. Under Admin permissions, choose Admin, enter the appointment reason and confirm with the current Super Admin password. Demotion uses the same form with Member selected. Both revoke existing sessions and recovery links. The UI cannot create another Super Admin.

## Storage and access controls

Management operations lock actor and target records, recheck current permissions, mutate and append the audit entry in one database operation. Audit failure rolls back the change. Server actions require current Super Admin access and the existing second-factor confirmation; client fields cannot grant privileges. Password-confirmed deletion attempts are limited to five per 15 minutes. Staff Admins cannot call CRM mutation actions, including profile editing and deletion.

Password reset tokens contain random 256-bit secrets; only SHA-256 hashes are stored. Tokens expire, are single use and are bound to the account session version. Passwords use bcrypt cost 12 and never appear in exports or audit metadata. Staff passkeys, second-factor confirmation and recovery procedures are documented in [admin-security.md](admin-security.md).

Audit rows, deposit events and financial journals are append-only through database triggers. A database owner can still change schema: restrict provider/deployment credentials and maintain provider backups and restoration procedures. This feature does not certify backup retention, encryption at rest, penetration testing or compliance.

Email verification is currently paused at the owner's request. Normal self-service recovery still needs working email delivery. Until configured, Super Admin can create a private one-hour recovery link for a non-owner account after confirming the owner password. Independently verify the recipient before sharing it. Owner recovery is not available to another Admin.