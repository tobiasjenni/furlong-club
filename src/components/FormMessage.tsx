export function FormMessage({ state }: { state?: { error?: string; ok?: string } | null }) {
  if (!state?.error && !state?.ok) return null;
  return (
    <p role="status" className={`rounded-xl px-3 py-2 text-sm ${state.error ? "bg-red-500/10 text-red-300" : "bg-emerald-500/10 text-emerald-300"}`}>
      {state.error ?? state.ok}
    </p>
  );
}
