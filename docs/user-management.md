# User management and owner access

The configured owner account is Super Admin. Staff accounts are Admin; registered customers are Members. Members create their own accounts and accept the age and terms declarations themselves.

## Appoint an admin

Sign in again after this release, then open Admin → Users & CRM. Search for the registered member and open their profile. Confirm their email ownership if necessary, recording how ownership was checked. The account must be active and have signed in. Under Admin permissions, choose Admin, enter an appointment reason and confirm with your current Super Admin password. Demotion uses the same form with Member selected.

Only Super Admin can change roles, confirm email ownership manually, create account recovery links or export the member list. Admins can manage ordinary member status, tags, notes and memberships, plus existing content and financial review tools. Admins cannot manage other admins, change their own privileges or alter the owner account. The UI cannot create another Super Admin.

## Stored data and permissions

Management operations lock the actor and target records, recheck current permissions, mutate and write the audit entry in one database operation. Role changes and status changes revoke sessions and outstanding email/recovery links. Recovery tokens contain random 256-bit secrets; only SHA-256 hashes are stored. Tokens expire, are single use and are bound to the account session version. Password resets and password changes invalidate prior sessions and links atomically. Passwords use bcrypt cost 12 and are never exported or included in audit metadata.

The owner cannot be demoted, suspended, closed or deleted through the application. Admin accounts must first be demoted before self-service closure. Admin email changes require a separate ownership review; the self-service email form does not change admin addresses. Closure never deletes financial or audit history and is blocked while balances, frozen wallets, pending payments or trading obligations remain. Suspension preserves the records and balance.

Audit rows, deposit events and financial journals are append-only through database triggers. This protects normal application operations; a database owner can still change database schema. Keep database and deployment credentials restricted and enable provider backups and restoration procedures. Backup settings, encryption at rest, independent penetration testing, identity checks and regulatory compliance are not certified by this change. No MFA has been added in this release.

Email delivery must be configured for normal self-service recovery. Until then, only Super Admin can create a private one-hour recovery link for a non-owner account after entering the owner password. Verify the recipient independently before sharing it. Owner recovery is intentionally not available to another admin; retain secure access to the deployment and database accounts for owner recovery.
