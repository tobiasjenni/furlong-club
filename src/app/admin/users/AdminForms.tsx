"use client";
import { useActionState } from "react";
import { type AdminFormState, inviteUser, sendResetLink } from "@/app/actions/admin";
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

export function InviteForm() {
  const [state, action] = useActionState(inviteUser, null);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="text-lg">Add a member</h2>
      <p className="muted text-sm">They get an email with a link to choose their own password.</p>
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input name="email" type="email" placeholder="Email" className="input" required />
        <input name="name" placeholder="Name (optional)" className="input" />
        <SubmitButton className="btn-gold">Send invite</SubmitButton>
      </div>
      <Result state={state} />
    </form>
  );
}

export function ResetLinkForm({ userId }: { userId: string }) {
  const [state, action] = useActionState(sendResetLink, null);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="userId" value={userId} />
      <SubmitButton className="btn-ghost w-full">Send password reset link</SubmitButton>
      <Result state={state} />
    </form>
  );
}
