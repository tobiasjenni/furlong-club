"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { appUrl } from "@/lib/config";
import { db } from "@/lib/db";
import { type Email, emailDelivers, inviteMessage, resetPasswordMessage, sendEmail } from "@/lib/email";
import { grantSubscription } from "@/lib/subscriptions";
import { issueToken } from "@/lib/tokens";

export async function addNote(form: FormData) {
  const admin = await requireAdmin();
  const subjectId = String(form.get("userId"));
  const body = String(form.get("body") ?? "").trim();
  if (!body) return;
  await db.crmNote.create({ data: { subjectId, authorId: admin.id, body: body.slice(0, 4000) } });
  revalidatePath(`/admin/users/${subjectId}`);
}

export async function updateUser(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("userId"));
  const role = form.get("role") === "ADMIN" ? "ADMIN" : "USER";
  const statusInput = String(form.get("status"));
  const status = statusInput === "SUSPENDED" || statusInput === "CLOSED" ? statusInput : "ACTIVE";
  const tags = String(form.get("tags") ?? "").split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20);
  if (id === admin.id && (role !== "ADMIN" || status !== "ACTIVE")) return; // can't lock yourself out
  const before = await db.user.findUniqueOrThrow({ where: { id } });
  // Suspending, closing or demoting someone signs them out immediately.
  const revoke = status !== "ACTIVE" || role !== before.role;
  await db.user.update({ where: { id }, data: { role, status, tags, ...(revoke ? { sessionVersion: { increment: 1 } } : {}) } });
  await audit(admin.id, "admin.user_updated", id, { role, status, tags });
  revalidatePath(`/admin/users/${id}`);
}

export async function grantPlan(form: FormData) {
  const admin = await requireAdmin();
  const userId = String(form.get("userId"));
  const planId = String(form.get("planId"));
  const days = Math.min(Math.max(Number(form.get("days")) || 30, 1), 366);
  await grantSubscription(userId, planId, days, "admin");
  await audit(admin.id, "admin.subscription_granted", userId, { planId, days });
  revalidatePath(`/admin/users/${userId}`);
}

export async function cancelSubscription(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("id"));
  const sub = await db.subscription.update({ where: { id }, data: { status: "CANCELLED" } });
  await audit(admin.id, "admin.subscription_cancelled", sub.userId, { id });
  revalidatePath(`/admin/users/${sub.userId}`);
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
  const admin = await requireAdmin();
  const id = String(form.get("userId"));
  await db.user.update({ where: { id }, data: { emailVerifiedAt: new Date() } });
  await audit(admin.id, "admin.email_confirmed", id);
  revalidatePath(`/admin/users/${id}`);
}

export type AdminFormState = { error?: string; ok?: string; link?: string } | null;

// Without an email provider the admin gets the link to pass on by hand.
async function deliver(email: Email, link: string): Promise<AdminFormState> {
  if (!emailDelivers()) return { ok: "Email isn't connected yet, so share this link yourself:", link };
  await sendEmail(email);
  return { ok: `Email sent to ${email.to}.` };
}

export async function inviteUser(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({ email: z.string().trim().toLowerCase().email("Enter a valid email").max(254), name: z.string().trim().max(80) })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, name } = parsed.data;
  if (await db.user.findUnique({ where: { email } })) return { error: "A user with this email already exists." };
  const user = await db.user.create({
    data: {
      email,
      name: name || null,
      // Unusable until they set their own password from the invite link.
      passwordHash: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12),
      ageConfirmedAt: new Date(),
    },
  });
  await audit(admin.id, "admin.user_invited", user.id, { email });
  const token = await issueToken(user.id, "RESET_PASSWORD", 3 * 24 * 60 * 60 * 1000);
  revalidatePath("/admin/users");
  return deliver(inviteMessage(email, token), `${appUrl}/reset-password?token=${token}`);
}

export async function sendResetLink(_: AdminFormState, form: FormData): Promise<AdminFormState> {
  const admin = await requireAdmin();
  const user = await db.user.findUniqueOrThrow({ where: { id: String(form.get("userId")) } });
  const token = await issueToken(user.id, "RESET_PASSWORD");
  await audit(admin.id, "admin.reset_link_sent", user.id);
  return deliver(resetPasswordMessage(user.email, token), `${appUrl}/reset-password?token=${token}`);
}

export async function signOutUser(form: FormData) {
  const admin = await requireAdmin();
  const id = String(form.get("userId"));
  await db.user.update({ where: { id }, data: { sessionVersion: { increment: 1 } } });
  await audit(admin.id, "admin.user_signed_out", id);
  revalidatePath(`/admin/users/${id}`);
}
