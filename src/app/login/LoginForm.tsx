"use client";
import Link from "next/link";
import { PasswordInput } from "@/components/PasswordInput";
import { useActionState, useState } from "react";
import { login } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action, pending] = useActionState(login, null);
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="space-y-4" aria-busy={pending}>
      {notice && !state && <FormMessage state={{ ok: notice }} />}
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="none" spellCheck={false} maxLength={254} value={email} onChange={event => setEmail(event.target.value)} required />
      </div>
      <PasswordInput id="password" name="password" label="Password" autoComplete="current-password" required />
      <p className="text-right"><Link href="/forgot-password" className="text-xs text-gold-300 hover:underline">Forgot password?</Link></p>
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Signing in…">Sign in</SubmitButton>
      <p className="muted text-center text-sm">
        New here? <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="text-gold-300 hover:underline">Create a free account</Link>
      </p>
    </form>
  );
}
