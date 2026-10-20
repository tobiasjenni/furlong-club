import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Disclaimer } from "@/components/Disclaimer";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { date } from "@/lib/format";
import { userTier } from "@/lib/subscriptions";

export default async function VideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const video = await db.video.findUnique({ where: { slug: (await params).slug } });
  if (!video || (!video.published && user.role !== "ADMIN")) notFound();
  if (video.minTier > (await userTier(user.id)) && user.role !== "ADMIN") redirect("/plans");

  const isFile = /\.(mp4|webm|m3u8)(\?|$)/i.test(video.embedUrl);
  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <Link href="/videos" className="text-sm text-gold-300 hover:underline">← All videos</Link>
      <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
        {isFile ? (
          <video src={video.embedUrl} controls controlsList="nodownload" className="h-full w-full" />
        ) : (
          <iframe src={video.embedUrl} title={video.title} className="h-full w-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen />
        )}
      </div>
      <div>
        <p className="text-sm text-gold-300">{video.category} · {video.durationMin} min · {date(video.publishedAt)}</p>
        <h1 className="mt-1 text-3xl">{video.title}</h1>
        <p className="mt-3 text-cream/80">{video.summary}</p>
      </div>
      <Disclaimer compact />
    </div>
  );
}
