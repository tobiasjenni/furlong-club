"use client";
import { useActionState } from "react";
import { resendVerification } from "@/app/actions/auth";

export function VerifyBanner({ email, deliveryAvailable, deliveryFailed = false }: { email: string; deliveryAvailable: boolean; deliveryFailed?: boolean }) {
  const [state, action, pending] = useActionState(resendVerification, null);
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-gold-400/30 bg-gold-400/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p role={state?.error ? "alert" : "status"}>
        <strong className="text-gold-300">Please confirm your email.</strong>{" "}
        {state?.ok ?? state?.error ?? (deliveryAvailable ? (deliveryFailed ? "Your account is ready, but we could not send your confirmation email. Request a new link below or contact support@furlong.club." : `Check ${email} for your confirmation link, including your spam folder. You can explore your account now; confirm your address before upgrading.`) : "Your account is ready. Contact support@furlong.club to confirm your address while email delivery is unavailable.")}
      </p>
      {deliveryAvailable && <form action={action}>
        <button className="btn-ghost shrink-0 px-4 py-2" disabled={pending} aria-busy={pending}>{pending ? "Sending…" : "Resend link"}</button>
      </form>}
    </div>
  );
}
