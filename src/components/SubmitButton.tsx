"use client";
import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "btn-gold w-full", disabled = false, pendingLabel = "Please wait…" }: { children: React.ReactNode; className?: string; disabled?: boolean; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled} aria-busy={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}
