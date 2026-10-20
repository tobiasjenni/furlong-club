"use client";
import { useActionState } from "react";
import { startCheckout } from "@/app/actions/checkout";
import { FormMessage } from "@/components/FormMessage";
import { SubmitButton } from "@/components/SubmitButton";

export function CheckoutForm({ plan, options }: { plan: string; options: { label: string }[] }) {
  const [state, action] = useActionState(startCheckout, null);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="plan" value={plan} />
      <p className="label">Pay with</p>
      {options.map((o, i) => (
        <label key={o.label} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/15 px-4 py-3 has-[:checked]:border-gold-400 has-[:checked]:bg-gold-400/5">
          <input type="radio" name="option" value={i} defaultChecked={i === 0} className="accent-gold-400" />
          <span className="text-sm">{o.label}</span>
        </label>
      ))}
      <FormMessage state={state} />
      <SubmitButton>Continue to payment</SubmitButton>
    </form>
  );
}
