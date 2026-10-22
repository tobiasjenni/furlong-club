import { isAdmin } from "@/lib/roles";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { HostPortrait } from "@/components/HostPortrait";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { date } from "@/lib/format";
import { userTier } from "@/lib/subscriptions";
import { playback } from "@/lib/video";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const video = await db.video.findFirst({ where: { slug: (await params).slug, ...(!isAdmin(user.role) ? { published: true } : {}) }, select: { title: true } });
  return { title: video?.title ?? "Video" };
}

export default async function VideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const video = await db.video.findUnique({ where: { slug: (await params).slug } });
  if (!video || (!video.published && !isAdmin(user.role))) notFound();
  if (video.minTier > (await userTier(user.id)) && !isAdmin(user.role)) redirect("/membership");

  const source = playback(video);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link prefetch={false} href="/videos" className="text-sm text-gold-300 hover:underline">← All videos</Link>
      <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
        {!source ? (
          <div className="silk-stripes flex h-full flex-col items-center justify-center gap-3 bg-turf-900 p-6 text-center">
            <HostPortrait className="h-24 w-24 sm:h-32 sm:w-32" rounded="rounded-full" />
            <p className="font-display text-xl">Video in preparation</p>
            <p className="max-w-sm text-sm text-cream/60">This lesson is not available to watch yet. Check the library for published videos.</p>
          </div>
        ) : source.kind === "file" ? (
          <video src={source.src} controls controlsList="nodownload" className="h-full w-full" />
        ) : (
          <iframe src={source.src} title={video.title} className="h-full w-full" allow="accelerometer; gyroscope; autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" />
        )}
      </div>
      <div>
        <p className="text-sm text-gold-300">{video.category} · {video.durationMin} min · {date(video.publishedAt)}</p>
        <h1 className="mt-1 text-3xl">{video.title}</h1>
        <p className="mt-3 text-cream/80">{video.summary}</p>
      </div>
    </div>
  );
}
