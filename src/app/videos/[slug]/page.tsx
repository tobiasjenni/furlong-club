import { brand } from "@/lib/config";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Disclaimer } from "@/components/Disclaimer";
import { HostPortrait } from "@/components/HostPortrait";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { date } from "@/lib/format";
import { userTier } from "@/lib/subscriptions";
import { playback } from "@/lib/video";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const video = await db.video.findUnique({ where: { slug: (await params).slug }, select: { title: true } });
  return { title: video?.title ?? "Video" };
}

export default async function VideoPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const video = await db.video.findUnique({ where: { slug: (await params).slug } });
  if (!video || (!video.published && user.role !== "ADMIN")) notFound();
  if (video.minTier > (await userTier(user.id)) && user.role !== "ADMIN") redirect("/plans");

  const source = playback(video);
  return (
    <div className="container-page max-w-4xl space-y-6 py-10">
      <Link href="/videos" className="text-sm text-gold-300 hover:underline">← All videos</Link>
      <div className="aspect-video overflow-hidden rounded-2xl border border-white/10 bg-black">
        {!source ? (
          <div className="silk-stripes flex h-full flex-col items-center justify-center gap-3 bg-turf-900 p-6 text-center">
            <HostPortrait className="h-24 w-24 sm:h-32 sm:w-32" rounded="rounded-full" />
            <p className="font-display text-xl">{brand.host.first} is still in the edit suite</p>
            <p className="max-w-sm text-sm text-cream/60">This video is being prepared and will appear here as soon as it&apos;s ready.</p>
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
      <Disclaimer compact />
    </div>
  );
}
