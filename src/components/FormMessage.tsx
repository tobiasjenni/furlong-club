"use client";
import { useEffect, useRef } from "react";

export function FormMessage({ state, focusOnError = false }: { state?: { error?: string; ok?: string } | null; focusOnError?: boolean }) {
  const message = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (focusOnError && state?.error) message.current?.focus();
  }, [focusOnError, state]);
  if (!state?.error && !state?.ok) return null;
  return (
    <p ref={message} tabIndex={focusOnError && state.error ? -1 : undefined} role={state.error ? "alert" : "status"} className={`rounded-xl px-3 py-2 text-sm ${state.error ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>
      {state.error ?? state.ok}
    </p>
  );
}
