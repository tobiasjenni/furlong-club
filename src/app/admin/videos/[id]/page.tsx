import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { deleteVideo, saveVideo } from "@/app/actions/admin";
import { db } from "@/lib/db";

export default async function EditVideo({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const admin = await requireAdmin();
  const canEdit = admin.role === "SUPER_ADMIN";
  const { id } = await params;
  const { error } = await searchParams;
  if (id === "new" && !canEdit) notFound();
  const video = id === "new" ? null : await db.video.findUnique({ where: { id } });
  if (id !== "new" && !video) notFound();
  const plans = await db.plan.findMany({ orderBy: { tier: "asc" } });

  return (
    <div className="max-w-2xl space-y-4">
      <form action={saveVideo} className="card space-y-4">
        <h2 className="text-xl">{video ? canEdit ? "Edit video" : "Video details" : "New video"}</h2>
        <fieldset disabled={!canEdit} className="space-y-4">
        {error && <p className="rounded-xl bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p>}
        <input type="hidden" name="id" value={video?.id ?? ""} />
        <div><label className="label" htmlFor="video-title">Title</label><input id="video-title" name="title" defaultValue={video?.title} className="input" required /></div>
        <div><label className="label" htmlFor="video-slug">Slug (URL)</label><input id="video-slug" name="slug" defaultValue={video?.slug} className="input" required pattern="[a-z0-9-]+" /></div>
        <div><label className="label" htmlFor="video-summary">Summary</label><textarea id="video-summary" name="summary" rows={3} defaultValue={video?.summary} className="input" /></div>
        <div>
          <label className="label" htmlFor="video-bunnyVideoId">Bunny Stream video ID (recommended)</label>
          <input id="video-bunnyVideoId" name="bunnyVideoId" defaultValue={video?.bunnyVideoId ?? ""} className="input" placeholder="e.g. 1b2c3d4e-5f60-7a8b-9c0d-112233445566" />
          <p className="muted mt-1 text-xs">Plays through a signed link that expires after an hour, so paid videos can&apos;t be shared outside the site.</p>
        </div>
        <div>
          <label className="label" htmlFor="video-embedUrl">Or a video URL</label>
          <input id="video-embedUrl" name="embedUrl" defaultValue={video?.embedUrl ?? ""} className="input" placeholder="https://www.youtube-nocookie.com/embed/… or https://…/file.mp4" />
          <p className="muted mt-1 text-xs">Fine for free videos. Anyone with this link can watch it.</p>
        </div>
        <div><label className="label" htmlFor="video-thumbnail">Thumbnail URL (optional)</label><input id="video-thumbnail" name="thumbnail" defaultValue={video?.thumbnail ?? ""} className="input" /></div>
        <div className="workspace-form-grid grid grid-cols-3 gap-3">
          <div><label className="label" htmlFor="video-category">Category</label><input id="video-category" name="category" defaultValue={video?.category ?? "Fundamentals"} className="input" /></div>
          <div><label className="label" htmlFor="video-durationMin">Minutes</label><input id="video-durationMin" name="durationMin" type="number" min="0" defaultValue={video?.durationMin ?? 10} className="input" /></div>
          <div>
            <label className="label" htmlFor="video-minTier">Who can watch</label>
            <select id="video-minTier" name="minTier" defaultValue={video?.minTier ?? 1} className="input">{plans.map((p) => <option key={p.id} value={p.tier}>{p.name}+</option>)}</select>
          </div>
        </div>
        <label className="flex gap-2 text-sm"><input type="checkbox" name="published" defaultChecked={video?.published ?? true} className="accent-gold-400" />Published</label>
        {canEdit && <SubmitButton className="btn-gold workspace-action-positive" pendingLabel="Saving video…">Save video</SubmitButton>}
        </fieldset>
      </form>
      {canEdit && video && (
        <form action={deleteVideo}><input type="hidden" name="id" value={video.id} /><SubmitButton className="btn-danger" pendingLabel="Deleting video…">Delete video</SubmitButton></form>
      )}
    </div>
  );
}
