"use client";
import { useActionState } from "react";
import { type AdminFormState, changeUserRole, sendResetLink } from "@/app/actions/admin";
import { SubmitButton } from "@/components/SubmitButton";

function Result({ state }: { state: AdminFormState }) {
  if (!state) return null;
  if (state.error) return <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{state.error}</p>;
  return (
    <div className="space-y-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
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
    <p className="muted text-sm">Only Super Admin can change access. Admins can manage members, content, deposits and trading records. They cannot appoint admins, recover accounts or change your owner account.</p>
    <p className="muted text-sm">Promotion requires an active account, confirmed email and a previous sign-in. Changing a role signs the member out and cancels existing recovery links.</p>
    <input type="hidden" name="userId" value={userId} />
    <label className="label">Account role<select name="role" defaultValue={role} className="input mt-1"><option value="USER">Member</option><option value="ADMIN">Admin</option></select></label>
    <label className="label">Reason<input name="reason" minLength={10} maxLength={500} required className="input mt-1" /></label>
    <label className="label">Your current password<input name="password" type="password" autoComplete="current-password" required className="input mt-1" /></label>
    <SubmitButton className="btn-gold">Confirm access change</SubmitButton>
    <Result state={state} />
  </form>;
}
