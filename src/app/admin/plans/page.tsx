import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth";
import { savePlan } from "@/app/actions/admin";
import { db } from "@/lib/db";

export default async function AdminPlans() {
  const admin = await requireAdmin();
  const canEdit = admin.role === "SUPER_ADMIN";
  const plans = await db.plan.findMany({ orderBy: { sortOrder: "asc" } });
  return (
    <div className="grid gap-4 xl:grid-cols-3"><p className="card text-sm text-gold-300 xl:col-span-3">Subscriptions are coming soon. These settings are retained for future use; editing or activating a plan does not reopen purchases. Trading with Rob does not require paid membership.</p>
      {plans.map((p) => (
        <form key={p.id} action={savePlan} className="card space-y-3">
          <fieldset disabled={!canEdit} className="space-y-3">
          <input type="hidden" name="id" value={p.id} />
          <p className="muted text-xs">Tier {p.tier} · /{p.slug}</p>
          <div><label className="label" htmlFor={p.id + "-name"}>Name</label><input id={p.id + "-name"} name="name" defaultValue={p.name} className="input" /></div>
          <div><label className="label" htmlFor={p.id + "-tagline"}>Tagline</label><input id={p.id + "-tagline"} name="tagline" defaultValue={p.tagline} className="input" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="label" htmlFor={p.id + "-price"}>Price (USD)</label><input id={p.id + "-price"} name="price" type="number" step="0.01" min="0" defaultValue={p.priceCents / 100} className="input" /></div>
            <div><label className="label" htmlFor={p.id + "-intervalDays"}>Days</label><input id={p.id + "-intervalDays"} name="intervalDays" type="number" min="1" defaultValue={p.intervalDays} className="input" /></div>
          </div>
          <div><label className="label" htmlFor={p.id + "-features"}>Features (one per line)</label><textarea id={p.id + "-features"} name="features" rows={5} defaultValue={p.features.join("\n")} className="input" /></div>
          <label className="flex gap-2 text-sm"><input type="checkbox" name="active" defaultChecked={p.active} className="accent-gold-400" />Active plan configuration (sales paused)</label>
          {canEdit && <SubmitButton className="btn-gold workspace-action-positive w-full" pendingLabel="Saving plan…">Save plan</SubmitButton>}
          </fieldset>
        </form>
      ))}
    </div>
  );
}
