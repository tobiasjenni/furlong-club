"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { endSession, requireUser, revokeSessions, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { passwordChangedMessage, resetPasswordMessage, sendEmail, verifyEmailMessage } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, safeNext } from "@/lib/request";
import { consumeToken, issueToken } from "@/lib/tokens";

export type FormState = { error?: string; ok?: string } | null;

const password = z.string().min(10, "Password must be at least 10 characters").max(200, "Password is too long");

const signupSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Please enter a valid email").max(254),
  password,
  country: z.string().trim().max(60).optional(),
  age: z.literal("on", { errorMap: () => ({ message: "You must confirm you are 18 or over" }) }),
  terms: z.literal("on", { errorMap: () => ({ message: "Please accept the terms" }) }),
  marketing: z.string().optional(),
});

// Used when the email is unknown, so a failed login takes as long as a real one and doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("timing-equaliser-not-a-real-password", 12);

async function sendVerification(user: { id: string; email: string }) {
  const token = await issueToken(user.id, "VERIFY_EMAIL");
  await sendEmail(verifyEmailMessage(user.email, token));
}

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  if (!rateLimit(`signup:${await clientIp()}`, 10, 60 * 60 * 1000)) return { error: "Too many attempts, try again later." };
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password, country, marketing } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) return { error: "An account with this email already exists. Try signing in." };

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
  await sendVerification(user).catch((err) => console.error("verification email failed", err));
  await startSession(user);
  redirect("/dashboard?welcome=1");
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const pass = String(form.get("password") ?? "").slice(0, 200);
  const ip = await clientIp();
  if (!rateLimit(`login-ip:${ip}`, 30, 15 * 60 * 1000) || !rateLimit(`login:${email}`, 8, 15 * 60 * 1000)) {
    return { error: "Too many attempts, try again in 15 minutes." };
  }

  const user = await db.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(pass, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    await audit(user?.id ?? null, "user.login_failed", email, { ip });
    return { error: "Email or password is incorrect." };
  }
  if (user.status === "SUSPENDED") return { error: "This account is suspended. Please contact support." };
  if (user.status === "CLOSED") return { error: "This account has been closed. Contact support if you'd like it reopened." };

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit(user.id, "user.login", user.id, { ip });
  await startSession(user);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await endSession();
  redirect("/");
}

export async function resendVerification(_: FormState): Promise<FormState> {
  const user = await requireUser();
  if (user.emailVerifiedAt) return { ok: "Your email is already confirmed." };
  if (!rateLimit(`verify:${user.id}`, 3, 60 * 60 * 1000)) return { error: "We've sent a few already. Please check your inbox and spam folder." };
  await sendVerification(user);
  return { ok: `We've sent a new link to ${user.email}.` };
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase().slice(0, 254);
  const sent = { ok: "If an account exists for that email, we've sent a reset link. It's valid for one hour." };
  if (!rateLimit(`reset-ip:${await clientIp()}`, 10, 60 * 60 * 1000) || !rateLimit(`reset:${email}`, 3, 60 * 60 * 1000)) return sent;
  const user = await db.user.findUnique({ where: { email } });
  if (user && user.status === "ACTIVE") {
    const token = await issueToken(user.id, "RESET_PASSWORD");
    await sendEmail(resetPasswordMessage(user.email, token)).catch((err) => console.error("reset email failed", err));
    await audit(user.id, "user.password_reset_requested", user.id);
  }
  return sent;
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = password.safeParse(form.get("password"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const userId = await consumeToken(String(form.get("token") ?? ""), "RESET_PASSWORD");
  if (!userId) return { error: "This reset link is invalid or has expired. Please request a new one." };
  const user = await db.user.update({
    where: { id: userId },
    // Clicking the emailed link proves ownership of the address.
    data: { passwordHash: await bcrypt.hash(parsed.data, 12), emailVerifiedAt: new Date() },
  });
  await audit(user.id, "user.password_reset", user.id);
  await revokeSessions(user.id);
  await sendEmail(passwordChangedMessage(user.email)).catch(() => {});
  redirect("/login?reset=1");
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
  if (!rateLimit(`pw:${user.id}`, 5, 15 * 60 * 1000)) return { error: "Too many attempts, try again later." };
  const parsed = password.safeParse(form.get("next"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await bcrypt.compare(String(form.get("current") ?? ""), user.passwordHash))) return { error: "Current password is incorrect." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(parsed.data, 12) } });
  await audit(user.id, "user.password_changed", user.id);
  await revokeSessions(user.id, true);
  await sendEmail(passwordChangedMessage(user.email)).catch(() => {});
  return { ok: "Password updated. Other devices have been signed out." };
}

export async function signOutEverywhere() {
  const user = await requireUser();
  await revokeSessions(user.id);
  redirect("/login");
}

export async function closeAccount(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (form.get("confirm") !== "CLOSE") return { error: 'Type CLOSE to confirm.' };
  if (!(await bcrypt.compare(String(form.get("password") ?? ""), user.passwordHash))) return { error: "Password is incorrect." };
  await db.user.update({ where: { id: user.id }, data: { status: "CLOSED", closedAt: new Date(), marketingOptIn: false } });
  await audit(user.id, "user.closed_account", user.id);
  await revokeSessions(user.id);
  redirect("/?closed=1");
}
