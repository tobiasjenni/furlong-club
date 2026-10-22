export default function Loading() {
  return (
    <div className="container-page animate-pulse space-y-6 py-10" aria-busy="true" aria-label="Loading">
      <p role="status" className="muted text-sm">Loading your page…</p>
      <div className="h-9 w-1/3 rounded-xl bg-white/10" />
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-40 rounded-2xl bg-white/5" />)}
      </div>
      <div className="h-64 rounded-2xl bg-white/5" />
    </div>
  );
}
