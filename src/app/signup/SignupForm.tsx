"use client";
import Link from "next/link";
import { useActionState } from "react";
import { signup } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function SignupForm() {
  const [state, action] = useActionState(signup, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input className="input" id="name" name="name" autoComplete="name" required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <label className="label" htmlFor="password">Password</label>
        <input className="input" id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
        <p className="muted mt-1 text-xs">At least 10 characters.</p>
      </div>
      <div>
        <label className="label" htmlFor="country">Country <span className="muted">(optional)</span></label>
        <input className="input" id="country" name="country" autoComplete="country-name" />
      </div>
      <label className="flex gap-3 text-sm">
        <input type="checkbox" name="age" className="mt-1 accent-gold-400" required />
        <span>I confirm I am 18 years or older.</span>
      </label>
      <label className="flex gap-3 text-sm">
        <input type="checkbox" name="terms" className="mt-1 accent-gold-400" required />
        <span>
          I accept the <Link href="/legal/terms" className="text-gold-300 underline">terms</Link> and understand the videos are
          education and opinion, not a guarantee of results.
        </span>
      </label>
      <label className="flex gap-3 text-sm">
        <input type="checkbox" name="marketing" className="mt-1 accent-gold-400" />
        <span className="muted">Send me new videos and race-day reminders by email.</span>
      </label>
      <FormMessage state={state} />
      <SubmitButton>Create account</SubmitButton>
      <p className="muted text-center text-sm">
        Already a member? <Link href="/login" className="text-gold-300 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
