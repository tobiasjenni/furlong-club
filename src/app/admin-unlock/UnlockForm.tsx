"use client";
import { useActionState } from "react";
import { PasswordInput } from "@/components/PasswordInput";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";
import { unlockAdmin } from "./actions";

export function UnlockForm({ next }: { next: string }) {
  const [state, action] = useActionState(unlockAdmin, null);
  return <form action={action} className="space-y-5">
    <input type="hidden" name="next" value={next} />
    <PasswordInput id="admin-password" name="password" label="Your current password" autoComplete="current-password" required autoFocus />
    <FormMessage state={state} />
    <SubmitButton className="btn-gold w-full">Continue to device verification</SubmitButton>
    <p className="muted text-sm">Admin access stays confirmed for 15 minutes in this browser. Account changes and signing out end this confirmation.</p>
  </form>;
}
