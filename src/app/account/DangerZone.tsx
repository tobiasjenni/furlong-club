"use client";
import { useActionState } from "react";
import { closeAccount, signOutEverywhere } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function DangerZone({ protectedAccount = false }: { protectedAccount?: boolean }) {
  const [state, action] = useActionState(closeAccount, null);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card">
        <h2 className="text-xl">Sessions</h2>
        <p className="muted mt-1 text-sm">Signed in on a shared or lost device? Sign out everywhere, including here.</p>
        <form action={signOutEverywhere} className="mt-4"><button className="btn-ghost">Sign out on all devices</button></form>
      </div>
      {protectedAccount ? <div className="card"><h2 className="text-xl">Protected admin account</h2><p className="muted mt-2 text-sm">An admin must be demoted to Member before account closure. The Super Admin owner account cannot be closed here.</p></div> : <div className="card">
        <h2 className="text-xl">Take a break or close your account</h2>
        <p className="muted mt-1 text-sm">
          If betting has stopped being fun, closing your account stops all emails and access straight away. To reopen it later, contact support.
          Any wallet credit, pending deposits or open trading allocations and payouts must be resolved first. Contact support if you need to pause access while those are reviewed.
        </p>
        <form action={action} className="mt-4 space-y-3">
          <div><label className="label" htmlFor="close-password">Your password</label><input id="close-password" name="password" type="password" className="input" autoComplete="current-password" required /></div>
          <div><label className="label" htmlFor="close-confirm">Type CLOSE to confirm</label><input id="close-confirm" name="confirm" className="input" autoComplete="off" autoCapitalize="characters" spellCheck={false} pattern="CLOSE" required /></div>
          <FormMessage state={state} focusOnError />
          <SubmitButton className="btn-danger" pendingLabel="Closing account…">Close my account</SubmitButton>
        </form>
      </div>}
    </div>
  );
}
