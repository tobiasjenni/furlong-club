import Link from "next/link";
import { db } from "@/lib/db";
import { date } from "@/lib/format";

export default async function AdminVideos() {
  const videos = await db.video.findMany({ orderBy: { publishedAt: "desc" } });
  return (
    <div className="space-y-4">
      <Link href="/admin/videos/new" className="btn-gold">Add video</Link>
      <div className="card overflow-x-auto p-0 sm:p-0">
        <table className="table">
          <thead><tr><th>Title</th><th>Category</th><th>Min tier</th><th>Published</th><th>Date</th></tr></thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v.id}>
                <td><Link href={`/admin/videos/${v.id}`} className="text-gold-300 hover:underline">{v.title}</Link></td>
                <td>{v.category}</td><td>{v.minTier}</td><td>{v.published ? "Yes" : "Draft"}</td><td>{date(v.publishedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
