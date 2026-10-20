"use client";
import Link from "next/link";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, action] = useActionState(login, null);
  return (
    <form action={action} className="space-y-4">
      {notice && !state && <FormMessage state={{ ok: notice }} />}
      <input type="hidden" name="next" value={next ?? ""} />
      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div>
        <div className="flex items-baseline justify-between">
          <label className="label" htmlFor="password">Password</label>
          <Link href="/forgot-password" className="text-xs text-gold-300 hover:underline">Forgot password?</Link>
        </div>
        <input className="input" id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <FormMessage state={state} />
      <SubmitButton>Sign in</SubmitButton>
      <p className="muted text-center text-sm">
        New here? <Link href="/signup" className="text-gold-300 hover:underline">Create a free account</Link>
      </p>
    </form>
  );
}
