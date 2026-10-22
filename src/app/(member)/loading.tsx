export default function PortalLoading() {
  return <div className="portal-loading" role="status" aria-label="Loading your member workspace"><p className="portal-small">Loading your account records…</p><div className="portal-skeleton" style={{ height: 55 }} /><div className="portal-skeleton" style={{ height: 410 }} /><div className="portal-two-col"><div className="portal-skeleton" /><div className="portal-skeleton" /></div></div>;
}
