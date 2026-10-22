import { requireAdmin } from "@/lib/auth";
import { savePlan } from "@/app/actions/admin";
import { db } from "@/lib/db";

export default async function AdminPlans() {
  const admin = await requireAdmin();
  const canEdit = admin.role === "SUPER_ADMIN";
  const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {plans.map((p) => (
        <form key={p.id} action={savePlan} className="card space-y-3">
          <fieldset disabled={!canEdit} className="space-y-3">
          <input type="hidden" name="id" value={p.id} />
          <p className="muted text-xs">Tier {p.tier} · /{p.slug}</p>
          <div><label className="label">Name</label><input name="name" defaultValue={p.name} className="input" /></div>
          <div><label className="label">Tagline</label><input name="tagline" defaultValue={p.tagline} className="input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">Price (USD)</label><input name="price" type="number" step="0.01" min="0" defaultValue={p.priceCents / 100} className="input" /></div>
            <div><label className="label">Days</label><input name="intervalDays" type="number" min="1" defaultValue={p.intervalDays} className="input" /></div>
          </div>
          <div><label className="label">Features (one per line)</label><textarea name="features" rows={5} defaultValue={p.features.join("\n")} className="input" /></div>
          <label className="flex gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} className="accent-gold-400" />Visible on site</label>
          {canEdit && <button className="btn-gold w-full">Save plan</button>}
          </fieldset>
        </form>
      ))}
    </div>
  );
}
