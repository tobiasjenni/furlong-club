"use client";
import { PasswordPair } from "@/components/PasswordInput";
import { useActionState } from "react";
import { resetPassword } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword, null);
  return (
    <form action={action} className="space-y-4" aria-busy={pending}>
      <input type="hidden" name="token" value={token} />
      <PasswordPair label="New password" confirmationLabel="Confirm new password" hint="At least 10 characters. Changing your password signs out all devices." />
      <FormMessage state={state} />
      <SubmitButton>Set new password</SubmitButton>
    </form>
  );
}
