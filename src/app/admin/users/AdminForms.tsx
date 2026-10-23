"use client";
import { useActionState } from "react";
import { type AdminFormState, changeUserRole, sendResetLink, editUserProfile, deleteUserAccount } from "@/app/actions/admin";
import { SubmitButton } from "@/components/SubmitButton";

function Result({ state }: { state: AdminFormState }) {
  if (!state) return null;
  if (state.error) return <p role="alert" className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{state.error}</p>;
  return (
    <div role="status" className="space-y-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
      <p>{state.ok}</p>
      {state.link && (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 break-all text-xs text-cream/80">{state.link}</code>
          <button type="button" className="btn-ghost shrink-0 px-3 py-1 text-xs" onClick={() => navigator.clipboard.writeText(state.link!)}>Copy</button>
        </div>
      )}
    </div>
  );
}

export function ProfileForm({ user }: { user: { id: string; name: string | null; country: string | null; tags: string[]; status: string; updatedAt: string } }) {
  const [state, action] = useActionState(editUserProfile, null);
  return <form action={action} className="card space-y-4" id="edit-profile">
    <h3 className="text-lg">Edit member profile</h3>
    <input type="hidden" name="userId" value={user.id} />
    <input type="hidden" name="expectedUpdatedAt" value={user.updatedAt} />
    <label className="label">Name<input name="name" autoComplete="off" maxLength={120} defaultValue={user.name ?? ''} className="input" /></label>
    <label className="label">Country<input name="country" autoComplete="off" maxLength={80} defaultValue={user.country ?? ''} className="input" /></label>
    <label className="label">Tags (comma separated)<input name="tags" maxLength={1238} defaultValue={user.tags.join(', ')} className="input" placeholder="vip, referral" /></label>
    <label className="label">Account status<select name="status" defaultValue={user.status} className="input">
      <option value="ACTIVE">Active{user.status === 'CLOSED' ? ' — restore account' : ''}</option>
      <option value="SUSPENDED">Suspended — sign-in blocked</option>
      {user.status === 'CLOSED' && <option value="CLOSED">Deleted / closed — sign-in blocked</option>}
    </select></label>
    <p className="muted text-sm">Suspension blocks sign-in and keeps the member’s records and funds. Use Delete account below to close an account. Restoring access does not renew expired or cancelled memberships.</p>
    <p className="muted text-sm">The member manages their own sign-in email. Use Access &amp; security for password recovery. Age and marketing consent remain the member’s own declarations.</p>
    <label className="label">Reason for change<textarea name="reason" required minLength={10} maxLength={500} rows={2} className="input" placeholder="Explain the change for the audit history" /></label>
    <SubmitButton pendingLabel="Saving profile…">Save member profile</SubmitButton>
    <Result state={state} />
  </form>;
}

export function DeleteAccountForm({ userId, email, closed }: { userId: string; email: string; closed: boolean }) {
  const [state, action] = useActionState(deleteUserAccount, null);
  return <section className="card space-y-3 border border-red-400/25" id="delete-account">
    <h3 className="text-lg">{closed ? 'Account deleted / closed' : 'Delete account'}</h3>
    <p className="muted text-sm">Account deletion closes access and signs the member out of every device. Payment, trading and audit records stay in the CRM. This is not a personal-data erasure request. The email stays reserved; you can restore the same account above.</p>
    {closed ? <p className="text-sm text-gold-300">Sign-in is disabled. Choose Active under Account status to restore access.</p> : <details className="rounded-xl border border-red-400/20 p-3">
      <summary className="cursor-pointer text-sm font-semibold text-red-300">Review account deletion</summary>
      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="userId" value={userId} />
        <p className="muted text-sm">First resolve wallet balances, frozen wallets, pending deposits, open trading allocations and active memberships. Deletion is checked again when you confirm.</p>
        <p className="break-all text-sm">Account: <strong>{email}</strong></p>
        <label className="label">Type the member’s email to confirm<input name="confirmation" type="email" required maxLength={254} autoComplete="off" spellCheck={false} className="input" /></label>
        <label className="label">Reason for deletion<textarea name="reason" required minLength={10} maxLength={500} rows={2} className="input" /></label>
        <label className="label">Your Super Admin password<input type="password" name="password" autoComplete="current-password" required className="input" /></label>
        <SubmitButton className="btn-ghost w-full border-red-400/40 text-red-300" pendingLabel="Closing account…">Delete account and disable sign-in</SubmitButton>
        <Result state={state} />
      </form>
    </details>}
  </section>;
}

export function ResetLinkForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(sendResetLink, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <label className="label">Your current password<input name="password" type="password" autoComplete="current-password" className="input mt-1" required /></label>
      <SubmitButton className="btn-ghost w-full">Create password reset link</SubmitButton>
      <Result state={state} />
    </form>
  );
}

export function RoleForm({ userId, role }: { userId: string; role: string }) {
  const [state, action] = useActionState(changeUserRole, null);
  return <form action={action} className="card space-y-3">
    <h3 className="text-lg">Admin permissions</h3>
    <p className="muted text-sm">Only you as Super Admin can change access or approve deposits. Admins have read-only access to club records and can manage their own security settings.</p>
    <p className="muted text-sm">Promotion requires an active account, confirmed email and a previous sign-in. Changing a role signs the member out and cancels existing recovery links.</p>
    <input type="hidden" name="userId" value={userId} />
    <label className="label">Account role<select name="role" defaultValue={role} className="input mt-1"><option value="USER">Member</option><option value="ADMIN">Admin · Read-only</option></select></label>
    <label className="label">Reason<input name="reason" minLength={10} maxLength={500} required className="input mt-1" /></label>
    <label className="label">Your current password<input name="password" type="password" autoComplete="current-password" required className="input mt-1" /></label>
    <SubmitButton className="btn-gold">Confirm access change</SubmitButton>
    <Result state={state} />
  </form>;
}
