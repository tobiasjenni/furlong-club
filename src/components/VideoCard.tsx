import Link from "next/link";
import type { Video } from "@prisma/client";

const tierNames = ["Free", "Form Room", "Inner Circle"];

export function VideoCard({ video, locked }: { video: Video; locked: boolean }) {
  return (
    <Link href={locked ? "/plans" : `/videos/${video.slug}`} className="group card flex flex-col overflow-hidden p-0 sm:p-0">
      <div className="silk-stripes relative flex aspect-video items-center justify-center bg-turf-800">
        {video.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={video.thumbnail} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <span className={`relative flex h-14 w-14 items-center justify-center rounded-full ${locked ? "bg-black/50" : "bg-gold-400 text-turf-950 group-hover:scale-105"} transition`}>
          {locked ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
          ) : (
            <svg viewBox="0 0 24 24" className="ml-1 h-6 w-6" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>
          )}
        </span>
        <span className="absolute bottom-2 right-2 rounded bg-black/60 px-1.5 py-0.5 text-xs">{video.durationMin} min</span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-gold-300">{video.category}</span>
          <span className="muted">· {tierNames[video.minTier] ?? `Tier ${video.minTier}`}</span>
        </div>
        <h3 className="mt-1.5 font-sans text-base font-semibold">{video.title}</h3>
        <p className="muted mt-1 line-clamp-2 text-sm">{video.summary}</p>
        {locked && <p className="mt-3 text-xs font-semibold text-gold-300">Upgrade to watch →</p>}
      </div>
    </Link>
  );
}
