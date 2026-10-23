"use server";

import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { endSession, requireUser, revokeSessions, startSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { emailDelivers, passwordChangedMessage, resetPasswordMessage, sendEmail, verifyEmailMessage } from "@/lib/email";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp, safeNext } from "@/lib/request";
import { matchesPassword, newPasswordSchema, passwordSchema } from "@/lib/passwords";
import type { Role } from "@prisma/client";
import { consumeToken, issueToken } from "@/lib/tokens";
import { hasClubInvitation } from "@/lib/club-invitation";
import { emailVerificationRequired } from "@/lib/email-verification";

export type FormState = { error?: string; ok?: string } | null;

const signupSchema = z.object({
  name: z.string().trim().min(1, "Please enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Please enter a valid email").max(254),
  password: passwordSchema,
  passwordConfirm: z.string({ required_error: "Please confirm your password" }).min(1, "Please confirm your password"),
  country: z.string().trim().max(60).optional(),
  age: z.literal("on", { errorMap: () => ({ message: "You must confirm you are 18 or over" }) }),
  terms: z.literal("on", { errorMap: () => ({ message: "Please accept the terms" }) }),
  marketing: z.string().optional(),
}).refine(value => value.password === value.passwordConfirm, { path: ["passwordConfirm"], message: "Passwords do not match. Enter the same password again." });

// Used when the email is unknown, so a failed login takes as long as a real one and doesn't reveal which emails exist.
// A fixed cost-12 hash of a random string, so the comparison costs the same as a real one.
const DUMMY_HASH = "$2a$12$C6UzMDM.H6dfI/f/IKcEeO5mJ4mRFKuJ1bQnzD6gjmpo8l3Ws7vqS";

async function sendVerification(user: { id: string; email: string }) {
  const token = await issueToken(user.id, "VERIFY_EMAIL",undefined,user.email);
  await sendEmail(verifyEmailMessage(user.email, token));
}

export async function signup(_: FormState, form: FormData): Promise<FormState> {
  try {
    if (!await hasClubInvitation()) return { error: "Please open the club entrance before creating an account." };
  } catch { return { error: "The club entrance is temporarily unavailable. Please try again later." }; }
  if (!await rateLimit(`signup:${await clientIp()}`, 10, 60 * 60 * 1000)) return { error: "Too many attempts, try again later." };
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { name, email, password, country, marketing } = parsed.data;

  if (await db.user.findUnique({ where: { email } })) return { error: "An account with this email already exists. Try signing in." };

  let user;
  try { user = await db.user.create({
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
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return { error: "An account with this email already exists. Sign in or use password recovery." };
    console.error("Account creation could not be completed");
    return { error: "We could not create your account right now. Please try again." };
  }
  await audit(user.id, "user.signup", user.id);
  let verificationSent = true;
  if (emailVerificationRequired()) await sendVerification(user).catch(() => {
    verificationSent = false;
    console.error("verification email failed");
  });
  await startSession(user);
  redirect(safeNext(form.get("next"), verificationSent ? "/dashboard?welcome=1" : "/dashboard?welcome=1&verification=unavailable"));
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const pass = String(form.get("password") ?? "");
  const ip = await clientIp();
  if (!await rateLimit(`login-ip:${ip}`, 30, 15 * 60 * 1000) || !await rateLimit(`login:${email}`, 8, 15 * 60 * 1000)) {
    return { error: "Too many attempts, try again in 15 minutes." };
  }

  if (!z.string().email().max(254).safeParse(email).success || !pass || new TextEncoder().encode(pass).length > 72) return { error: "Email or password is incorrect." };
  const user = await db.user.findUnique({ where: { email } });
  const valid = await bcrypt.compare(pass, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    await audit(user?.id ?? null, "user.login_failed", email, { ip });
    return { error: "Email or password is incorrect." };
  }
  if (user.status === "SUSPENDED") return { error: "This account is suspended. Please contact support." };
  if (user.status === "CLOSED") return { error: "This account has been closed. Contact support if you'd like it reopened." };

  const signedIn = await db.$queryRaw<{ id: string; role: Role; sessionVersion: number }[]>`UPDATE "User" SET "lastLoginAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC'),"updatedAt"=(CURRENT_TIMESTAMP AT TIME ZONE 'UTC') WHERE id=${user.id} AND status='ACTIVE' AND "passwordHash"=${user.passwordHash} AND "sessionVersion"=${user.sessionVersion} RETURNING id,role,"sessionVersion"`;
  if (!signedIn[0]) return { error: "Your account changed during sign-in. Please try again." };
  await audit(user.id, "user.login", user.id, { ip });
  await startSession(signedIn[0]);
  redirect(safeNext(form.get("next")));
}

export async function logout() {
  await endSession();
  // Use the account endpoint directly. Following the locked home page through
  // an action redirect can leave its entrance form posting to the home URL.
  redirect("/login");
}

export async function resendVerification(_: FormState): Promise<FormState> {
  const user = await requireUser();
  if (!emailVerificationRequired()) return { ok: "Email confirmation is not required at the moment. Your account is ready to use." };
  if (user.emailVerifiedAt) return { ok: "Your email is already confirmed." };
  if (!emailDelivers()) return { error: "Please contact support@furlong.club to confirm your email while email delivery is unavailable." };
  if (!await rateLimit(`verify:${user.id}`, 3, 60 * 60 * 1000)) return { error: "We've sent a few already. Please check your inbox and spam folder." };
  try { await sendVerification(user); }
  catch {
    console.error("Verification email could not be delivered");
    return { error: "We could not send your link right now. Please try again later or contact support@furlong.club. Your account is still available." };
  }
  return { ok: `We've sent a new link to ${user.email}.` };
}

export async function requestPasswordReset(_: FormState, form: FormData): Promise<FormState> {
  if (!emailDelivers()) return { error: "Email recovery is currently unavailable. Please contact support@furlong.club for help." };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const sent = { ok: "If that email matches an account, check your inbox and spam folder for a reset link. Links are valid for one hour. If it does not arrive, try again later or contact support@furlong.club." };
  if (!await rateLimit(`reset-ip:${await clientIp()}`, 10, 60 * 60 * 1000) || !await rateLimit(`reset:${email}`, 3, 60 * 60 * 1000)) return sent;
  if (!z.string().email().max(254).safeParse(email).success) return sent;
  const user = await db.user.findUnique({ where: { email } });
  if (user && user.status === "ACTIVE") {
    try {
      const token = await issueToken(user.id, "RESET_PASSWORD",undefined,user.email);
      await sendEmail(resetPasswordMessage(user.email, token));
      await audit(user.id, "user.password_reset_requested", user.id);
    } catch { console.error("Password recovery could not be delivered"); }
  }
  return sent;
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!await rateLimit(`reset-consume:${await clientIp()}`,10,15*60*1000)) return { error: "Too many attempts. Try again later." };
  const userId = await consumeToken(String(form.get("token") ?? ""), "RESET_PASSWORD", await bcrypt.hash(parsed.data.password,12));
  if (!userId) return { error: "This reset link is invalid or has expired. Please request a new one." };
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await endSession();
  await sendEmail(passwordChangedMessage(user.email)).catch(() => {});
  redirect("/login?reset=1");
}

export async function updateProfile(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const schema = z.object({ name: z.string().trim().min(1, "Please enter your name").max(80, "Keep your name within 80 characters"), country: z.string().trim().max(60, "Keep your country within 60 characters"), marketing: z.string().optional() });
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db.user.update({
    where: { id: user.id },
    data: { name: parsed.data.name, country: parsed.data.country || null, marketingOptIn: parsed.data.marketing === "on" },
  });
  revalidatePath("/(member)", "layout");
  return { ok: "Profile saved." };
}

export async function changePassword(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!await rateLimit(`pw:${user.id}`, 5, 15 * 60 * 1000)) return { error: "Too many attempts, try again later." };
  const parsed = newPasswordSchema.safeParse({ password: form.get("next"), passwordConfirm: form.get("nextConfirm") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await matchesPassword(String(form.get("current") ?? ""), user.passwordHash))) return { error: "Current password is incorrect." };
  const changed = await db.$queryRaw<{ changed: boolean }[]>`SELECT auth_change_password(${user.id},${user.passwordHash},${await bcrypt.hash(parsed.data.password,12)}) AS changed`;
  if (!changed[0]?.changed) return { error: "Your account changed. Sign in again and retry." };
  await audit(user.id, "user.password_changed", user.id);
  await startSession(await db.user.findUniqueOrThrow({ where: { id: user.id } }));
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
  if (user.role !== "USER") return { error: "Ask the owner to remove admin access before closing an admin account. The Super Admin owner account is protected." };
  if (!await rateLimit(`close:${user.id}`, 5, 15 * 60 * 1000)) return { error: "Too many attempts. Please try again later." };
  if (form.get("confirm") !== "CLOSE") return { error: 'Type CLOSE to confirm.' };
  if (!(await matchesPassword(String(form.get("password") ?? ""), user.passwordHash))) return { error: "Password is incorrect." };
  const closed = await db.$queryRaw<{ result: string }[]>`SELECT wallet_close_account(${user.id}) AS result`;
  if (closed[0]?.result !== "closed") return { error: "Please contact support to resolve your wallet balance, pending deposits and any open trading allocations or payouts before closing your account." };
  await audit(user.id, "user.closed_account", user.id);
  await revokeSessions(user.id);
  redirect("/?closed=1");
}

export async function changeEmail(_: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (user.role !== "USER") return { error: "Admin email changes require a verified ownership review. Contact the owner before changing this address." };
  if (!await rateLimit(`email-change:${user.id}`, 5, 60 * 60 * 1000)) return { error: "Too many attempts, try again later." };
  const parsed = z.string().trim().toLowerCase().email("Please enter a valid email").max(254).safeParse(form.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const email = parsed.data;
  if (email === user.email) return { error: "That's already your email." };
  if (!(await matchesPassword(String(form.get("password") ?? ""), user.passwordHash))) return { error: "Password is incorrect." };
  if (await db.user.findUnique({ where: { email } })) return { error: "That email is already used by another account." };
  const changed = await db.$queryRaw<{changed:boolean}[]>`SELECT auth_change_email(${user.id},${user.passwordHash},${user.sessionVersion}::integer,${email},${crypto.randomUUID()}) AS changed`;
  if (!changed[0]?.changed) return { error: "Your account changed. Sign in again and retry." };
  await startSession(await db.user.findUniqueOrThrow({ where: { id: user.id } }));
  if (!emailVerificationRequired()) return { ok: "Email changed. Email confirmation is not required at the moment." };
  await sendVerification({ id: user.id, email }).catch(() => console.error("verification email failed"));
  return { ok: emailDelivers() ? `Email changed. We've sent a confirmation link to ${email}.` : "Email changed. Contact support@furlong.club to confirm your new address." };
}
