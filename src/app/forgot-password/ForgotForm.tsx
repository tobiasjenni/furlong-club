"use client";
import { useActionState, useState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function ForgotForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, null);
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="space-y-4" aria-busy={pending}>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required />
      </div>
      <FormMessage state={state} focusOnError />
      <SubmitButton pendingLabel="Requesting link…">Send reset link</SubmitButton>
    </form>
  );
}
