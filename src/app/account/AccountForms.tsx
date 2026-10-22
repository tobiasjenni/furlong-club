"use client";
import { PasswordInput, PasswordPair } from "@/components/PasswordInput";
import { useActionState, useState } from "react";
import { changeEmail, changePassword, updateProfile } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function ProfileForm({ name, country, marketing }: { name: string; country: string; marketing: boolean }) {
  const [state, action, pending] = useActionState(updateProfile, null);
  const [memberName, setMemberName] = useState(name);
  const [memberCountry, setMemberCountry] = useState(country);
  const [updates, setUpdates] = useState(marketing);
  return (
    <form action={action} className="space-y-4" aria-busy={pending}>
      <div><label className="label" htmlFor="name">Name</label><input className="input" id="name" name="name" autoComplete="name" maxLength={80} value={memberName} onChange={event => setMemberName(event.target.value)} required /></div>
      <div><label className="label" htmlFor="country">Country (optional)</label><input className="input" id="country" name="country" autoComplete="country-name" maxLength={60} value={memberCountry} onChange={event => setMemberCountry(event.target.value)} /></div>
      <label className="flex gap-3 text-sm"><input type="checkbox" name="marketing" checked={updates} onChange={event => setUpdates(event.target.checked)} className="mt-1 accent-gold-400" /><span>Email me club updates and new video notices</span></label>
      <FormMessage state={state} focusOnError />
      <SubmitButton className="btn-gold" pendingLabel="Saving profile…">Save profile</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, null);
  return (
    <form action={action} className="space-y-4">
      <PasswordInput id="current" name="current" label="Current password" autoComplete="current-password" required />
      <PasswordPair name="next" label="New password" confirmationName="nextConfirm" confirmationLabel="Confirm new password" />
      <FormMessage state={state} focusOnError />
      <SubmitButton className="btn-ghost" pendingLabel="Updating password…">Change password</SubmitButton>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, action] = useActionState(changeEmail, null);
  const [newEmail, setNewEmail] = useState("");
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="newEmail">New email</label><input className="input" id="newEmail" name="email" type="email" placeholder={email} autoComplete="email" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={newEmail} onChange={event => setNewEmail(event.target.value)} required /></div>
      <div><label className="label" htmlFor="emailPassword">Your password</label><input className="input" id="emailPassword" name="password" type="password" autoComplete="current-password" required /></div>
      <FormMessage state={state} focusOnError />
      <SubmitButton className="btn-ghost" pendingLabel="Updating email…">Change email</SubmitButton>
    </form>
  );
}
