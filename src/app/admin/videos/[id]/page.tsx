import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { deleteVideo, saveVideo } from "@/app/actions/admin";
import { db } from "@/lib/db";

export default async function EditVideo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const video = id === "new" ? null : await db.video.findUnique({ where: { id } });
  if (id !== "new" && !video) notFound();
  const plans = await db.plan.findMany({ orderBy: { tier: "asc" } });

  return (
    <div className="max-w-2xl space-y-4">
      <form action={saveVideo} className="card space-y-4">
        <h2 className="text-xl">{video ? "Edit video" : "New video"}</h2>
        {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <input type="hidden" name="id" value={video?.id ?? ""} />
        <div><label className="label">Title</label><input name="title" defaultValue={video?.title} className="input" required /></div>
        <div><label className="label">Slug (URL)</label><input name="slug" defaultValue={video?.slug} className="input" required pattern="[a-z0-9-]+" /></div>
        <div><label className="label">Summary</label><textarea name="summary" rows={3} defaultValue={video?.summary} className="input" /></div>
        <div>
          <label className="label">Bunny Stream video ID (recommended)</label>
          <input name="bunnyVideoId" defaultValue={video?.bunnyVideoId ?? ""} className="input" placeholder="e.g. 1b2c3d4e-5f60-7a8b-9c0d-112233445566" />
          <p className="muted mt-1 text-xs">Plays through a signed link that expires after an hour, so paid videos can&apos;t be shared outside the site.</p>
        </div>
        <div>
          <label className="label">Or a video URL</label>
          <input name="embedUrl" defaultValue={video?.embedUrl ?? ""} className="input" placeholder="https://www.youtube-nocookie.com/embed/… or https://…/file.mp4" />
          <p className="muted mt-1 text-xs">Fine for free videos. Anyone with this link can watch it.</p>
        </div>
        <div><label className="label">Thumbnail URL (optional)</label><input name="thumbnail" defaultValue={video?.thumbnail ?? ""} className="input" /></div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className="label">Category</label><input name="category" defaultValue={video?.category ?? "Fundamentals"} className="input" /></div>
          <div><label className="label">Minutes</label><input name="durationMin" type="number" min="0" defaultValue={video?.durationMin ?? 10} className="input" /></div>
          <div>
            <label className="label">Who can watch</label>
            <select name="minTier" defaultValue={video?.minTier ?? 1} className="input">{plans.map((p) => <option key={p.id} value={p.tier}>{p.name}+</option>)}</select>
          </div>
        </div>
        <label className="flex gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={video?.published ?? true} className="accent-gold-400" />Published</label>
        <button className="btn-gold">Save video</button>
      </form>
      {video && (
        <form action={deleteVideo}><input type="hidden" name="id" value={video.id} /><button className="btn-danger">Delete video</button></form>
      )}
    </div>
  );
}
