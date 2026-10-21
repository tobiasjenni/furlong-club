"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin, requireSuperAdmin } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { db } from "@/lib/db";
import { type Email, emailDelivers, resetPasswordMessage, sendEmail } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";


async function manage(actor: string, userId: string, operation: string, data: object) {
  const rows = await db.$queryRaw<{ result: string }[]>`SELECT admin_manage_user(${actor},${userId},${operation},${JSON.stringify(data)}::jsonb,${crypto.randomUUID()}) AS result`;
  revalidatePath('/admin/users');
  revalidatePath(`/admin/users/${userId}`);
  return rows[0]?.result ?? 'forbidden';
}

async function saveOrExplain(actor: string, uid: string, op: string, data: object) {
  const result = await manage(actor, uid, op, data);
  redirect(`/admin/users/${encodeURIComponent(uid)}?management=${encodeURIComponent(result)}`);
}

export async function addNote(form: FormData) {
  const admin = await requireAdmin();
  await saveOrExplain(admin.id, String(form.get('userId')), 'note', { body: String(form.get('body') ?? '').trim().slice(0,4000) });
}

export async function updateUser(form: FormData) {
  const admin = await requireAdmin();
  const tags = String(form.get('tags') ?? '').split(',').map(t => t.trim().slice(0,60)).filter(Boolean).slice(0,20);
  // Role fields are deliberately not accepted by the general account action.
  await saveOrExplain(admin.id, String(form.get('userId')), 'account', { status: String(form.get('status')), tags });
}

export async function changeUserRole(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireSuperAdmin();
  if (!await rateLimit(`admin-role:${admin.id}`,5,15*60*1000)) return { error: 'Too many attempts. Try again in 15 minutes.' };
  if (!await bcrypt.compare(String(form.get('password') ?? ''),admin.passwordHash)) return { error: 'Your current password is incorrect.' };
  const result = await manage(admin.id,String(form.get('userId')),'role', {
    role: String(form.get('role')), reason: String(form.get('reason') ?? '').trim().slice(0,500), passwordHash: admin.passwordHash,
  });
  const errors: Record<string,string> = { forbidden: 'This account is protected or your permissions have changed.', not_ready: 'The member must be active, have a confirmed email and have signed in before becoming an admin.', invalid: 'Choose Member or Admin and enter a reason of at least 10 characters.', unchanged: 'This account already has that role.' };
  return result === 'saved' ? { ok: 'Role updated. Existing sessions and recovery links have been revoked. The member must sign in again.' } : { error: errors[result] ?? 'Unable to update access. Refresh and try again.' };
}

export async function grantPlan(form: FormData) {
  const admin = await requireAdmin();
  const days = Number(form.get('days'));
  if (!Number.isInteger(days) || days<1 || days>366) return;
  await saveOrExplain(admin.id,String(form.get('userId')),'grant',{planId:String(form.get('planId')),days});
}

export async function cancelSubscription(form: FormData) {
  const admin = await requireAdmin();
  const sub = await db.subscription.findUniqueOrThrow({where:{id:String(form.get('id'))}});
  await saveOrExplain(admin.id,sub.userId,'cancel',{subscriptionId:sub.id});
}

const httpsUrl = z.string().trim().url().refine((u) => u.startsWith("https://"), "URLs must start with https://");

const videoSchema = z.object({
  title: z.string().trim().min(1).max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9-]+$/, "Slug: lowercase letters, numbers and dashes"),
  summary: z.string().trim().max(1000),
  bunnyVideoId: z.string().trim().regex(/^[0-9a-f-]{36}$/i, "Bunny video ID should look like 1b2c3d4e-....").optional().or(z.literal("")),
  embedUrl: httpsUrl.optional().or(z.literal("")),
  thumbnail: httpsUrl.optional().or(z.literal("")),
  category: z.string().trim().min(1).max(60),
  durationMin: z.coerce.number().int().min(0).max(600),
  minTier: z.coerce.number().int().min(0).max(10),
  published: z.string().optional(),
}).refine((v) => v.bunnyVideoId || v.embedUrl, "Add a Bunny video ID or a video URL");

export async function saveVideo(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id") ?? "");
  const parsed = videoSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) redirect(`/admin/videos/${id || "new"}?error=${encodeURIComponent(parsed.error.issues[0].message)}`);
  const { published, thumbnail, bunnyVideoId, embedUrl, ...rest } = parsed.data;
  const data = { ...rest, bunnyVideoId: bunnyVideoId || null, embedUrl: embedUrl || null, thumbnail: thumbnail || null, published: published === "on" };
  const video = id ? await db.video.update({ where: { id }, data }) : await db.video.create({ data });
  await audit(admin.id, id ? "admin.video_updated" : "admin.video_created", video.id);
  revalidatePath("/admin/videos");
  redirect("/admin/videos");
}

export async function deleteVideo(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id"));
  await db.video.delete({ where: { id } });
  await audit(admin.id, "admin.video_deleted", id);
  revalidatePath("/admin/videos");
  redirect("/admin/videos");
}

export async function savePlan(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id"));
  const schema = z.object({
    name: z.string().trim().min(1).max(60),
    tagline: z.string().trim().max(120),
    price: z.coerce.number().min(0).max(100000),
    intervalDays: z.coerce.number().int().min(1).max(366),
    features: z.string(),
    active: z.string().optional(),
  });
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return;
  const p = parsed.data;
  await db.plan.update({
    where: { id },
    data: {
      name: p.name,
      tagline: p.tagline,
      priceCents: Math.round(p.price * 100),
      intervalDays: p.intervalDays,
      features: p.features.split("\n").map((f) => f.trim()).filter(Boolean),
      active: p.active === "on",
    },
  });
  await audit(admin.id, "admin.plan_updated", id);
  revalidatePath("/admin/plans");
}

export async function confirmEmail(form: FormData) {
  const admin = await requireSuperAdmin();
  await saveOrExplain(admin.id,String(form.get('userId')),'email',{reason:String(form.get('reason') ?? '').trim().slice(0,500)});
}

export type AdminFormState = { error?: string; ok?: string; link?: string } | null;

async function deliver(email: Email, link: string): Promise<AdminFormState> {
  if (!emailDelivers()) return { ok: 'Email delivery is unavailable. Share this one-hour link privately only after verifying the member’s identity:', link };
  await sendEmail(email);
  return { ok: `Email sent to ${email.to}.` };
}

export async function sendResetLink(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireSuperAdmin();
  if (!await rateLimit(`admin-reset:${admin.id}`,5,60*60*1000)) return { error: 'Too many recovery requests. Try again later.' };
  if (!await bcrypt.compare(String(form.get('password') ?? ''),admin.passwordHash)) return { error: 'Your current password is incorrect.' };
  const user = await db.user.findUniqueOrThrow({ where: { id: String(form.get('userId')) } });
  const token = crypto.randomBytes(32).toString('base64url');
  const result = await manage(admin.id,user.id,'reset',{passwordHash:admin.passwordHash,tokenHash:crypto.createHash('sha256').update(token).digest('hex')});
  if (result !== 'saved') return { error: 'Recovery is unavailable for this protected or inactive account.' };
  try { return await deliver(resetPasswordMessage(user.email,token),`${appUrl}/reset-password?token=${token}`); }
  catch { return { error: 'The email could not be delivered. Try again after checking email delivery.' }; }
}

export async function signOutUser(form: FormData) {
  const admin = await requireAdmin();
  await saveOrExplain(admin.id,String(form.get('userId')),'signout',{});
}
