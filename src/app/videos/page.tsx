import { isAdmin } from "@/lib/roles";
import { VideoCard } from "@/components/VideoCard";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { userTier } from "@/lib/subscriptions";
import { hasPlayableSource } from "@/lib/video";

export const metadata = { title: "Videos" };

export default async function VideosPage() {
  const user = await requireUser();
  const [tier, videos] = await Promise.all([
    isAdmin(user.role) ? Infinity : userTier(user.id),
    db.video.findMany({ where: { published: true }, orderBy: [{ category: "asc" }, { publishedAt: "desc" }] }),
  ]);
  const categories = [...new Set(videos.map((v) => v.category))];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-3xl md:text-4xl">Video library</h1>
        <p className="muted mt-1">{videos.filter(v => v.minTier <= tier && hasPlayableSource(v)).length} videos available with your account · {videos.filter(v => !hasPlayableSource(v)).length} titles in preparation.</p>
        <p className="muted mt-3 text-sm">Trading with Rob is available through your free account. This optional learning library is being prepared. Titles marked In preparation cannot be watched yet. Subscriptions and additional club benefits are coming soon.</p>
      </div>
      {videos.length === 0 && <p className="card text-sm text-cream/75">The catalogue is being prepared. Check back for published lessons.</p>}
      {categories.map((c) => (
        <section key={c}>
          <h2 className="text-2xl">{c}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.filter((v) => v.category === c).map((v) => <VideoCard key={v.id} video={v} locked={v.minTier > tier} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
