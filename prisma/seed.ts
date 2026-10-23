import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertExistingOwner } from "./owner-bootstrap";
import { passwordSchema } from "../src/lib/passwords";

const db = new PrismaClient();

async function main() {
  const plans = [
    {
      slug: "paddock",
      name: "Paddock",
      tagline: "Free with an account",
      priceCents: 0,
      intervalDays: 28,
      tier: 0,
      sortOrder: 0,
      features: ["Free member dashboard", "Video catalogue previews", "Optional club updates"],
    },
    {
      slug: "form",
      name: "Form Room",
      tagline: "Trading with Rob at the heart of your membership",
      priceCents: 2900,
      intervalDays: 28,
      tier: 1,
      sortOrder: 1,
      features: ["Everything in Paddock", "Form and race-card lessons", "Trading with Rob"],
    },
    {
      slug: "inner-circle",
      name: "Inner Circle",
      tagline: "Go deeper into race-day analysis",
      priceCents: 7900,
      intervalDays: 28,
      tier: 2,
      sortOrder: 2,
      features: ["Trading with Rob access", "Everything in Form Room", "Published Inner Circle race-day videos", "Detailed race-card analysis", "One-off access with no automatic renewal"],
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
  // Update only the old default editorial copy; preserve customized content and real video sources.
  for (const slug of ["paddock", "form", "inner-circle"]) {
    const existing = await db.plan.findUnique({ where: { slug } });
    if (existing) {
      const features = existing.features.map(feature => feature.replaceAll("Trading with Harry", "Trading with Rob").replaceAll("Intro videos with Harry", "Intro videos with Rob"));
      const tagline = existing.tagline === "Trading with Harry at the heart of your membership" ? "Additional club benefits · Coming soon" : existing.tagline;
      if (tagline !== existing.tagline || JSON.stringify(features) !== JSON.stringify(existing.features)) await db.plan.update({ where: { slug }, data: { tagline, features } });
    }
  }
  for (const [slug, previous, summary] of [
    ["welcome-to-the-paddock", "Meet Harry and learn how the course is laid out.", "Meet Rob and learn how the course is laid out."],
    ["race-day-saturday", "Harry walks through this Saturday's feature races.", "Rob walks through this Saturday's feature races."],
  ]) await db.video.updateMany({ where: { slug, summary: previous, bunnyVideoId: null, embedUrl: null }, data: { summary } });
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
    const ownerEmail = email.trim().toLowerCase();
    const existingOwner = await db.user.findUnique({ where: { email: ownerEmail } });
    assertExistingOwner(existingOwner);
    if (!existingOwner && !passwordSchema.safeParse(password).success) throw new Error("Owner setup requires a valid strong password.");
    await db.user.upsert({
      where: { email: ownerEmail },
      update: {},
      create: {
        email: ownerEmail,
        passwordHash: await bcrypt.hash(password, 12),
        name: "Admin",
        role: "SUPER_ADMIN",
        ageConfirmedAt: new Date(),
        emailVerifiedAt: new Date(),
      },
    });
    // Recheck after upsert so a concurrent signup cannot silently become the owner.
    assertExistingOwner(await db.user.findUniqueOrThrow({ where: { email: ownerEmail } }));
    console.log('Configured owner ready.');
  }
}

main().catch(error => {
  console.error(error instanceof Error && error.message.startsWith("Owner setup") ? error.message : "Database setup failed. Check configuration securely.");
  process.exitCode = 1;
}).finally(() => db.$disconnect());
