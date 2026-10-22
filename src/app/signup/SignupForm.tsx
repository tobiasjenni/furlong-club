"use client";
import Link from "next/link";
import { PasswordPair } from "@/components/PasswordInput";
import { useActionState, useState } from "react";
import { signup } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function SignupForm({ next, verificationRequired = true }: { next?: string; verificationRequired?: boolean }) {
  const [state, action, pending] = useActionState(signup, null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const [age, setAge] = useState(false);
  const [terms, setTerms] = useState(false);
  const [marketing, setMarketing] = useState(false);
  return (
    <form action={action} className="space-y-4" aria-busy={pending}>
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input className="input" id="name" name="name" autoComplete="name" maxLength={80} value={name} onChange={event => setName(event.target.value)} required />
      </div>
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required />
      </div>
      <PasswordPair />
      <div>
        <label className="label" htmlFor="country">Country <span className="muted">(optional)</span></label>
        <input className="input" id="country" name="country" autoComplete="country-name" maxLength={60} value={country} onChange={event => setCountry(event.target.value)} />
      </div>
      <label className="flex gap-3 text-sm">
        <input type="checkbox" name="age" checked={age} onChange={event => setAge(event.target.checked)} className="mt-1 accent-gold-400" required />
        <span>I confirm I am 18 years or older.</span>
      </label>
      <label className="flex gap-3 text-sm">
        <input type="checkbox" name="terms" checked={terms} onChange={event => setTerms(event.target.checked)} className="mt-1 accent-gold-400" required />
        <span>
          I accept the <Link href="/legal/terms" target="_blank" rel="noopener noreferrer" aria-label="terms (opens in a new tab)" className="text-gold-300 underline">terms</Link> and understand the videos are
          education and opinion, not a guarantee of results.
        </span>
      </label>
      <label className="flex gap-3 text-sm">
        <input type="checkbox" name="marketing" checked={marketing} onChange={event => setMarketing(event.target.checked)} className="mt-1 accent-gold-400" />
        <span className="muted">Email me club updates and new video notices.</span>
      </label>
      <p className="muted text-xs">Free to join. No payment needed. {verificationRequired ? "We will email you a link to confirm your address." : "You can use your account straight away."}</p>
      <FormMessage state={state} focusOnError />
      <SubmitButton pendingLabel="Creating account…">Create account</SubmitButton>
      <p className="muted text-center text-sm">
        Already a member? <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="text-gold-300 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
