import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { walletTestMode } from "../src/lib/environment";

const db = new PrismaClient();
async function seed() {
  if (!walletTestMode()) throw new Error("This seed is only for the isolated wallet test environment");
  for (const [email, role, password] of [
    ["wallet-member@example.com", "USER", process.env.WALLET_TEST_MEMBER_PASSWORD],
    ["wallet-admin@example.com", "ADMIN", process.env.WALLET_TEST_ADMIN_PASSWORD],
  ] as const) {
    if (!password || password.length < 20) throw new Error("Set a strong test-account password");
    await db.user.upsert({ where: { email }, update: {}, create: {
      email, role, name: role === "ADMIN" ? "Wallet Test Admin" : "Wallet Test Member",
      passwordHash: await bcrypt.hash(password, 12), ageConfirmedAt: new Date(), emailVerifiedAt: new Date(),
    } });
  }
  console.log("Wallet test accounts are ready; passwords were not logged.");
}
seed().catch(() => { console.error("Could not seed wallet test accounts"); process.exitCode = 1; }).finally(() => db.$disconnect());
