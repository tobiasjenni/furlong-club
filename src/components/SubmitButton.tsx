"use client";
import { useFormStatus } from "react-dom";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function SubmitButton({ children, className = "btn-gold w-full", disabled = false, pendingLabel = "Please wait…", ...attributes }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> & { children: ReactNode; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <button {...attributes} type="submit" className={className} disabled={pending || disabled} aria-busy={pending}>
      {pending && <svg className="workspace-button-spinner" width="16" height="16" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="2" opacity=".25" /><path d="M10 3a7 7 0 0 1 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>}{pending ? pendingLabel : children}
    </button>
  );
}
