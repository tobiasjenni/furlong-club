import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { renewalReminderMessage, sendEmail } from "@/lib/email";
import { expireStalePayments } from "@/lib/payments";

const REMIND_DAYS_BEFORE = 3;

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const a = Buffer.from(header);
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Run once a day (vercel.json schedules it on Vercel; elsewhere use any cron with the bearer token).
export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  const soon = new Date(now.getTime() + REMIND_DAYS_BEFORE * 24 * 60 * 60 * 1000);
  const ending = await db.subscription.findMany({
    where: { status: "ACTIVE", reminderSentAt: null, endsAt: { gt: now, lte: soon }, user: { status: "ACTIVE" } },
    include: { user: true, plan: true },
    take: 500,
  });
  let reminded = 0;
  for (const sub of ending) {
    try {
      await sendEmail(renewalReminderMessage(sub.user.email, sub.plan.name, sub.endsAt, sub.plan.slug));
      await db.subscription.update({ where: { id: sub.id }, data: { reminderSentAt: now } });
      reminded++;
    } catch (err) {
      console.error("reminder failed", sub.id, err);
    }
  }

  const expiredSubs = await db.subscription.updateMany({ where: { status: "ACTIVE", endsAt: { lte: now } }, data: { status: "EXPIRED" } });
  const expiredPayments = await expireStalePayments();
  await db.authToken.deleteMany({ where: { expiresAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } } });

  return NextResponse.json({ reminded, expiredSubscriptions: expiredSubs.count, expiredPayments: expiredPayments.count });
}
