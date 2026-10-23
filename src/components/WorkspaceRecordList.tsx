import Link from "next/link";

type Record = { id: string; href: string; title: string; subtitle?: string; amount: string; status: string; meta: string; action: string };

export function WorkspaceRecordList({ records, empty }: { records: Record[]; empty: string }) {
  return records.length ? <ul className="workspace-record-list md:hidden">{records.map(record => <li key={record.id}><Link prefetch={false} href={record.href}><div className="workspace-record-top"><strong>{record.title}</strong><span>{record.amount}</span></div>{record.subtitle && <p>{record.subtitle}</p>}<span className="portal-pill gold mt-3">{record.status}</span><p className="mt-3">{record.meta}</p><span className="workspace-record-open">{record.action} →</span></Link></li>)}</ul> : <p className="card muted text-sm md:hidden">{empty}</p>;
}
