export default function AdminLoading() {
  return <div role="status" aria-label="Loading admin workspace" className="space-y-4 animate-pulse"><div className="grid grid-cols-2 gap-3 md:grid-cols-5">{[1,2,3,4,5].map(n => <div key={n} className="h-24 rounded-xl bg-white/5" />)}</div><div className="h-64 rounded-xl bg-white/5" /></div>;
}
