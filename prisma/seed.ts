import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const plans = [
    {
      slug: "paddock",
      name: "Paddock",
      tagline: "Free with an account",
      priceCents: 0,
      intervalDays: 33,
      tier: 0,
      sortOrder: 0,
      features: ["Free member dashboard", "Video catalogue previews", "Optional club updates"],
    },
    {
      slug: "form",
      name: "Form Room",
      tagline: "Build your racing foundations",
      priceCents: 2900,
      intervalDays: 33,
      tier: 1,
      sortOrder: 1,
      features: ["Everything in Paddock", "Form and race-card lessons", "Going, draw and staking discipline", "Access to published Form Room videos"],
    },
    {
      slug: "inner-circle",
      name: "Inner Circle",
      tagline: "Go deeper into race-day analysis",
      priceCents: 7900,
      intervalDays: 33,
      tier: 2,
      sortOrder: 2,
      features: ["Everything in Form Room", "Published Inner Circle race-day videos", "Detailed race-card analysis", "One-off access with no automatic renewal"],
    },
  ];
  for (const p of plans) {
    // Only create: prices and copy edited in the admin panel must survive redeploys.
    await db.plan.upsert({ where: { slug: p.slug }, update: {}, create: p });
  }

  const videos = [
    { slug: "welcome-to-the-paddock", title: "Welcome to the paddock", summary: "Meet Harry and learn how the course is laid out.", minTier: 0, durationMin: 6, category: "Fundamentals" },
    { slug: "how-odds-work", title: "How odds really work", summary: "Fractional, decimal and implied probability, explained simply.", minTier: 0, durationMin: 11, category: "Fundamentals" },
    { slug: "reading-a-race-card", title: "Reading a race card", summary: "Form figures, weights, draw and the going, line by line.", minTier: 1, durationMin: 18, category: "Form study" },
    { slug: "the-going-and-the-draw", title: "The going and the draw", summary: "Why ground conditions and stall position change everything.", minTier: 1, durationMin: 14, category: "Form study" },
    { slug: "bankroll-discipline", title: "Bankroll discipline", summary: "Staking plans, limits and knowing when to stop.", minTier: 1, durationMin: 12, category: "Discipline" },
    { slug: "race-day-saturday", title: "Race day: Saturday card", summary: "Harry walks through this Saturday's feature races.", minTier: 2, durationMin: 22, category: "Race day" },
  ];
  // One-off rename of the host (Rob -> Harry) in rows created by earlier seeds. Only touches untouched default copy.
  const paddock = await db.plan.findUnique({ where: { slug: "paddock" } });
  if (paddock && Array.isArray(paddock.features) && (paddock.features as string[]).includes("Intro videos with Rob")) {
    const features = (paddock.features as string[]).map((f) => (f === "Intro videos with Rob" ? "Intro videos with Harry" : f));
    await db.plan.update({ where: { slug: "paddock" }, data: { features } });
  }
  await db.video.updateMany({
    where: { slug: "welcome-to-the-paddock", summary: "Meet Rob and learn how the course is laid out." },
    data: { summary: "Meet Harry and learn how the course is laid out." },
  });
  await db.video.updateMany({
    where: { slug: "race-day-saturday", summary: "Rob walks through this Saturday's feature races." },
    data: { summary: "Harry walks through this Saturday's feature races." },
  });

  for (const v of videos) {
    await db.video.upsert({
      where: { slug: v.slug },
      update: {},
      create: v, // no source yet: upload Harry's videos in Admin → Videos
    });
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    await db.user.upsert({
      where: { email: email.toLowerCase() },
      update: {},
      create: {
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
        name: "Admin",
        role: "SUPER_ADMIN",
        ageConfirmedAt: new Date(),
        emailVerifiedAt: new Date(),
      },
    });
    // Promote only the explicitly configured owner, preserve credentials and status.
    const owner = await db.user.findUniqueOrThrow({ where: { email: email.toLowerCase() } });
    if (owner.role !== 'SUPER_ADMIN' && owner.status === 'ACTIVE') {
      await db.$transaction(async tx => {
        await tx.user.update({ where: { id: owner.id }, data: { role: 'SUPER_ADMIN', sessionVersion: { increment: 1 } } });
        await tx.authToken.deleteMany({ where: { userId: owner.id } });
        await tx.auditLog.create({ data: { actorId: owner.id, action: 'owner.super_admin_bootstrapped', target: owner.id, meta: { previousRole: owner.role } } });
      });
    }
    console.log('Configured owner ready.');
  }
}

main().finally(() => db.$disconnect());
