"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { endSession, requireUser, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

export type FormState = { error?: string; ok?: string } | null;

const signupSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Please enter a valid email"),
  password: z.string().min(10, "Password must be at least 10 characters").max(200),
  country: z.string().trim().max(60).optional(),
  age: z.literal("on", { errorMap: () => ({ message: "You must confirm you are 18 or over" }) }),
  terms: z.literal("on", { errorMap: () => ({ message: "Please accept the terms" }) }),
  marketing: z.string().optional(),
});

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

function safeNext(next: FormDataEntryValue | null) {
  const value = typeof next === "string" ? next : "";
  return value.startsWith("/") && !value.startsWith("//") ? value : "/dashboard";
}

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  if (!rateLimit(`signup:${await clientIp()}`, 10, 60 * 60 * 1000)) return { error: "Too many attempts, try again later." };
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password, country, marketing } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) return { error: "An account with this email already exists." };

  const user = await db.user.create({
    data: {
      name,
      email,
      country: country || null,
      passwordHash: await bcrypt.hash(password, 12),
      marketingOptIn: marketing === "on",
      ageConfirmedAt: new Date(),
      lastLoginAt: new Date(),
    },
  });
  await audit(user.id, "user.signup", user.id);
  await startSession(user);
  redirect("/dashboard?welcome=1");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (!rateLimit(`login:${await clientIp()}:${email}`, 8, 15 * 60 * 1000)) return { error: "Too many attempts, try again in 15 minutes." };

  const user = await db.user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) return { error: "Email or password is incorrect." };
  if (user.status !== "ACTIVE") return { error: "This account is suspended. Please contact support." };

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await startSession(user);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await endSession();
  redirect("/");
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const schema = z.object({ name: z.string().trim().min(1).max(80), country: z.string().trim().max(60), marketing: z.string().optional() });
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, country: parsed.data.country || null, marketingOptIn: parsed.data.marketing === "on" },
  });
  return { ok: "Profile saved." };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const current = String(form.get("current") ?? "");
  const next = String(form.get("next") ?? "");
  if (next.length < 10) return { error: "New password must be at least 10 characters." };
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Current password is incorrect." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 12) } });
  await audit(user.id, "user.password_changed", user.id);
  return { ok: "Password updated." };
}
