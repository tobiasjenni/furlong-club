import { db } from "./db";
import { renewalReminderMessage, sendEmail } from "./email";
import { expireStalePayments } from "./payments";

const REMIND_DAYS_BEFORE = 3;

// Renewal reminders and clean-up. Runs from /api/cron/daily or `npm run daily`.
export async function runDailyJobs(now = new Date()) {
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

  return { reminded, expiredSubscriptions: expiredSubs.count, expiredPayments: expiredPayments.count };
}
