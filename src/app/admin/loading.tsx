export default function AdminLoading() {
  return <div role="status" aria-label="Loading admin workspace" className="portal-loading"><span className="sr-only">Loading admin workspace…</span><div className="workspace-stats">{[1,2,3,4,5].map(n => <div key={n} className="portal-skeleton" style={{height:110}} />)}</div><div className="portal-skeleton" /></div>;
}
