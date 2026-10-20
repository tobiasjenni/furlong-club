"use client";
import { useActionState } from "react";
import { closeAccount, signOutEverywhere } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function DangerZone() {
  const [state, action] = useActionState(closeAccount, null);
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="card">
        <h2 className="text-xl">Sessions</h2>
        <p className="muted mt-1 text-sm">Signed in on a shared or lost device? Sign out everywhere, including here.</p>
        <form action={signOutEverywhere} className="mt-4"><button className="btn-ghost">Sign out on all devices</button></form>
      </div>
      <div className="card">
        <h2 className="text-xl">Take a break or close your account</h2>
        <p className="muted mt-1 text-sm">
          If betting has stopped being fun, closing your account stops all emails and access straight away. To reopen it later, contact support.
          Any wallet credit, pending deposits or open trading allocations and payouts must be resolved first. Contact support if you need to pause access while those are reviewed.
        </p>
        <form action={action} className="mt-4 space-y-3">
          <input name="password" type="password" placeholder="Your password" className="input" autoComplete="current-password" required />
          <input name="confirm" placeholder="Type CLOSE to confirm" className="input" required />
          <FormMessage state={state} />
          <SubmitButton className="btn-danger">Close my account</SubmitButton>
        </form>
      </div>
    </div>
  );
}
