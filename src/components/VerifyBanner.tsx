"use client";
import { useActionState } from "react";
import { resendVerification } from "@/app/actions/auth";

export function VerifyBanner({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendVerification, null);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gold-400/30 bg-gold-400/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p>
        <strong className="text-gold-300">Please confirm your email.</strong>{" "}
        {state?.ok ?? state?.error ?? `We sent a link to ${email}. You'll need it before you can upgrade.`}
      </p>
      <form action={action}>
        <button className="btn-ghost shrink-0 px-4 py-2" disabled={pending}>{pending ? "Sending…" : "Resend link"}</button>
      </form>
    </div>
  );
}
