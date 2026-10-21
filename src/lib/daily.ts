import { db } from "./db";
import { emailDelivers, renewalReminderMessage, sendEmail } from "./email";
import { expireStalePayments } from "./payments";

const REMIND_DAYS_BEFORE = 3;

// Renewal reminders and clean-up. Runs from /api/cron/daily or `npm run daily`.
export async function runDailyJobs(now = new Date()) {
  const soon = new Date(now.getTime() + REMIND_DAYS_BEFORE * 24 * 60 * 60 * 1000);
  const remindersAvailable = emailDelivers();
  const ending = remindersAvailable ? await db.subscription.findMany({
    where: { status: "ACTIVE", reminderSentAt: null, endsAt: { gt: now, lte: soon }, user: { status: "ACTIVE" } },
    include: { user: true, plan: true },
    take: 500,
  }) : [];
  let reminded = 0;
  for (const sub of ending) {
    try {
      await sendEmail(renewalReminderMessage(sub.user.email, sub.plan.name, sub.endsAt, sub.plan.slug));
      await db.subscription.update({ where: { id: sub.id }, data: { reminderSentAt: now } });
      reminded++;
    } catch {
      console.error("Renewal reminder delivery failed", { subscriptionId: sub.id });
    }
  }

  const expiredSubs = await db.$executeRaw`UPDATE "Subscription" SET status='EXPIRED' WHERE status='ACTIVE' AND "endsAt"<=${now}`;
  const expiredPayments = await expireStalePayments();
  await db.$executeRaw`DELETE FROM "AuthToken" WHERE "expiresAt"<${new Date(now.getTime() - 7 * 86400000)}`;
  await db.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt"<${now}`;

  return { reminded, remindersAvailable, expiredSubscriptions: expiredSubs, expiredPayments: expiredPayments.count };
}
