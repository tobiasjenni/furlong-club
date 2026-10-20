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
      tier: 0,
      sortOrder: 0,
      features: ["Intro videos with Rob", "Glossary of racing terms", "Weekly newsletter"],
    },
    {
      slug: "form",
      name: "Form Room",
      tagline: "The full training library",
      priceCents: 2900,
      tier: 1,
      sortOrder: 1,
      features: ["Everything in Paddock", "Full training video library", "Weekly race-card breakdowns", "Reading the form & going"],
    },
    {
      slug: "inner-circle",
      name: "Inner Circle",
      tagline: "Daily tips and live sessions",
      priceCents: 7900,
      tier: 2,
      sortOrder: 2,
      features: ["Everything in Form Room", "Daily race-day tip videos", "Monthly live Q&A", "Early access to new series"],
    },
  ];
  for (const p of plans) {
    // Only create: prices and copy edited in the admin panel must survive redeploys.
    await db.plan.upsert({ where: { slug: p.slug }, update: {}, create: p });
  }

  const videos = [
    { slug: "welcome-to-the-paddock", title: "Welcome to the paddock", summary: "Meet Rob and learn how the course is laid out.", minTier: 0, durationMin: 6, category: "Fundamentals" },
    { slug: "how-odds-work", title: "How odds really work", summary: "Fractional, decimal and implied probability, explained simply.", minTier: 0, durationMin: 11, category: "Fundamentals" },
    { slug: "reading-a-race-card", title: "Reading a race card", summary: "Form figures, weights, draw and the going, line by line.", minTier: 1, durationMin: 18, category: "Form study" },
    { slug: "the-going-and-the-draw", title: "The going and the draw", summary: "Why ground conditions and stall position change everything.", minTier: 1, durationMin: 14, category: "Form study" },
    { slug: "bankroll-discipline", title: "Bankroll discipline", summary: "Staking plans, limits and knowing when to stop.", minTier: 1, durationMin: 12, category: "Discipline" },
    { slug: "race-day-saturday", title: "Race day: Saturday card", summary: "Rob walks through this Saturday's feature races.", minTier: 2, durationMin: 22, category: "Race day" },
  ];
  for (const v of videos) {
    await db.video.upsert({
      where: { slug: v.slug },
      update: {},
      create: v, // no source yet: upload Rob's videos in Admin → Videos
    });
  }

  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (email && password) {
    await db.user.upsert({
      where: { email: email.toLowerCase() },
      update: { role: "ADMIN", status: "ACTIVE", emailVerifiedAt: new Date() },
      create: {
        email: email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
        name: "Admin",
        role: "ADMIN",
        ageConfirmedAt: new Date(),
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`Admin ready: ${email}`);
  }
}

main().finally(() => db.$disconnect());
