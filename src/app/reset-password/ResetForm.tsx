"use client";
import { useActionState } from "react";
import { resetPassword } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPassword, null);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label className="label" htmlFor="password">New password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        <p className="muted mt-1 text-xs">At least 10 characters. You'll be signed out on all devices.</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton>Set new password</SubmitButton>
    </form>
  );
}
