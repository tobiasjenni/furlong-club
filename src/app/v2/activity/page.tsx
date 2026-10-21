import Link from "next/link";
import { db } from "@/lib/db";
import { portalData } from "@/lib/portal-data";
import { pageParam, textParam } from "@/lib/portal-filters";
import { activityTypes, portalActivityQuery, type ActivityType, type PortalActivityPage } from "@/lib/portal-activity";
import { ActivityTable, PortalHeading } from "@/components/v2/PortalCommon";

export const metadata = { title: "Transactions" };
export default async function PortalActivity({ searchParams }: { searchParams: Promise<{ type?: string; q?: string; page?: string }> }) {
  const { user } = await portalData(); const params = await searchParams;
  const requestedType = textParam(params.type);
  const type: ActivityType = activityTypes.includes(requestedType as ActivityType) ? requestedType as ActivityType : "all";
  const search = textParam(params.q); const page = pageParam(params.page);
  const rows = await db.$queryRaw<{ activity: PortalActivityPage }[]>(portalActivityQuery(user.id, type, search, page));
  const data = rows[0].activity;
  const href = (next: number) => "/v2/activity?" + new URLSearchParams({ type, q: search, page: String(next) }).toString();
  return <><PortalHeading title="Transactions" description="Every posted credit movement and recorded allocation result. Search your references and filter by activity type." /><section className="portal-panel"><div className="portal-panel-heading"><h2>Account history</h2><span className="portal-pill">{data.total} record{data.total === 1 ? "" : "s"}</span></div><form className="portal-filter-bar" method="get"><div className="portal-search"><label htmlFor="activity-search">Search description or reference</label><input id="activity-search" className="input portal-search" name="q" defaultValue={search} maxLength={80} placeholder="Search your account history…" /></div><div><label htmlFor="activity-type">Activity type</label><select id="activity-type" name="type" className="input" defaultValue={type}>{activityTypes.map(kind => <option key={kind} value={kind}>{kind === "all" ? "All activity" : kind === "result" ? "Recorded profit / loss" : kind[0].toUpperCase() + kind.slice(1)}</option>)}</select></div><button className="btn-gold">Apply filters</button>{(search || type !== "all") && <Link className="btn-ghost" href="/v2/activity">Clear</Link>}</form><ActivityTable rows={data.rows} /><div className="portal-pagination"><span>Page {page} · up to 20 records per page</span><div className="flex gap-2">{page > 1 && <Link className="btn-ghost" href={href(page - 1)}>Previous</Link>}{page * 20 < data.total && <Link className="btn-ghost" href={href(page + 1)}>Next</Link>}</div></div><p className="portal-section-note">Credit change is the movement in your available club balance. External payouts and recorded results can have a $0 credit change: their amounts are tracked separately from spendable credit.</p></section></>;
}
