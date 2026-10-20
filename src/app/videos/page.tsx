import { Disclaimer } from "@/components/Disclaimer";
import { VideoCard } from "@/components/VideoCard";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { userTier } from "@/lib/subscriptions";

export const metadata = { title: "Videos" };

export default async function VideosPage() {
  const user = await requireUser();
  const [tier, videos] = await Promise.all([
    user.role === "ADMIN" ? Infinity : userTier(user.id),
    db.video.findMany({ where: { published: true }, orderBy: [{ category: "asc" }, { publishedAt: "desc" }] }),
  ]);
  const categories = [...new Set(videos.map((v) => v.category))];

  return (
    <div className="container-page space-y-10 py-10">
      <div>
        <h1 className="text-3xl md:text-4xl">Video library</h1>
        <p className="muted mt-1">{videos.filter((v) => v.minTier <= tier).length} of {videos.length} videos unlocked on your plan.</p>
      </div>
      {categories.map((c) => (
        <section key={c}>
          <h2 className="text-2xl">{c}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {videos.filter((v) => v.category === c).map((v) => <VideoCard key={v.id} video={v} locked={v.minTier > tier} />)}
          </div>
        </section>
      ))}
      <Disclaimer />
    </div>
  );
}
