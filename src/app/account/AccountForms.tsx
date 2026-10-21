"use client";
import { useActionState } from "react";
import { changeEmail, changePassword, updateProfile } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function ProfileForm({ name, country, marketing }: { name: string; country: string; marketing: boolean }) {
  const [state, action] = useActionState(updateProfile, null);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="name">Name</label><input className="input" id="name" name="name" defaultValue={name} required /></div>
      <div><label className="label" htmlFor="country">Country</label><input className="input" id="country" name="country" defaultValue={country} /></div>
      <label className="flex gap-3 text-sm"><input type="checkbox" name="marketing" defaultChecked={marketing} className="mt-1 accent-gold-400" /><span>Email me club updates and new video notices</span></label>
      <FormMessage state={state} />
      <SubmitButton className="btn-gold">Save profile</SubmitButton>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState(changePassword, null);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="current">Current password</label><input className="input" id="current" name="current" type="password" autoComplete="current-password" required /></div>
      <div><label className="label" htmlFor="next">New password</label><input className="input" id="next" name="next" type="password" autoComplete="new-password" minLength={10} required /></div>
      <FormMessage state={state} />
      <SubmitButton className="btn-ghost">Change password</SubmitButton>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, action] = useActionState(changeEmail, null);
  return (
    <form action={action} className="space-y-4">
      <div><label className="label" htmlFor="newEmail">New email</label><input className="input" id="newEmail" name="email" type="email" placeholder={email} autoComplete="email" required /></div>
      <div><label className="label" htmlFor="emailPassword">Your password</label><input className="input" id="emailPassword" name="password" type="password" autoComplete="current-password" required /></div>
      <FormMessage state={state} />
      <SubmitButton className="btn-ghost">Change email</SubmitButton>
    </form>
  );
}
