import fs from "node:fs";
import crypto from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, expect, it } from "vitest";
import { subscriptionSalesEnabled } from "../src/lib/subscription-sales";

let pg: PGlite;
const scalar = async (sql: string, args: unknown[] = []) => (await pg.query<{ result: unknown }>(sql, args)).rows[0]?.result;
const legacy = "legacy-subscription-invoice";
beforeAll(async () => {
  pg = new PGlite();
  for (const dir of fs.readdirSync("prisma/migrations").filter(n => /^\d/.test(n)).sort()) {
    if (dir === "20261023060000_trading_without_subscription") {
      await pg.exec(`INSERT INTO "User"(id,email,"passwordHash","ageConfirmedAt","emailVerifiedAt","updatedAt") VALUES('sub-user','sub-user@example.com','x',now(),now(),now());
        INSERT INTO "Plan"(id,slug,name,tagline,"priceCents",tier,features) VALUES('sub-plan','form','Form Room','Historical plan',2900,1,'{}');
        INSERT INTO "Payment"(id,"userId","planId","planName","planDays",purpose,"amountCents",currency,network,provider,"settlementStatus","updatedAt")
        VALUES('${legacy}','sub-user','sub-plan','Historical invoice',33,'SUBSCRIPTION',2900,'USDC','ERC20','mock','PENDING',now());
        INSERT INTO "WalletJournal"(id,"operationKey","userId",kind,description,"userDeltaCents","clearingDeltaCents","revenueDeltaCents")
        VALUES('seed-credit','seed-credit','sub-user','OPENING','Simulated test credit',100000,-100000,0);`);
    }
    await pg.exec(fs.readFileSync(`prisma/migrations/${dir}/migration.sql`, "utf8"));
  }
}, 30000);
afterAll(async () => { await pg?.close(); });

it("blocks new subscription charges even from a stale client with sufficient credit", async () => {
  expect(subscriptionSalesEnabled).toBe(false);
  for (let i = 0; i < 2; i++) expect(await scalar(`SELECT wallet_buy_plan('sub-user','sub-plan',2900,$1) AS result`, [crypto.randomUUID()])).toBe("sales_paused");
  expect(await scalar(`SELECT "balanceCents" AS result FROM "User" WHERE id='sub-user'`)).toBe(100000);
  expect(await scalar(`SELECT count(*)::int AS result FROM "WalletJournal" WHERE kind='PURCHASE'`)).toBe(0);
});
it("rejects new direct subscription invoices without stopping wallet deposits", async () => {
  await expect(pg.query(`INSERT INTO "Payment"(id,"userId","planId","planName","planDays",purpose,"amountCents",currency,network,provider,"updatedAt")
    VALUES($1,'sub-user','sub-plan','Form Room',33,'SUBSCRIPTION',2900,'USDC','ERC20','mock',now())`, [crypto.randomUUID()])).rejects.toThrow("Subscription sales are paused");
  expect(await scalar(`SELECT wallet_create_manual_deposit('sub-user',$1,50000,'USDT','TRC20','TPGPga3MfPrFThgFeGnBrfQN4aRCMPH5mf') AS result`, [crypto.randomUUID()])).toBe("created");
});
it("retains a pre-existing invoice and settles it once without rewriting its access period", async () => {
  const payload = JSON.stringify({ status: "CONFIRMED", providerStatus: "finished", receivedAmount: "29", outcomeAmount: "29", outcomeCurrency: "usdc", payoutHash: "simulation", validationError: null });
  await scalar(`SELECT wallet_apply_payment($1,'legacy-confirmation','test',$2::jsonb) AS result`, [legacy, payload]);
  await scalar(`SELECT wallet_apply_payment($1,'legacy-confirmation','test',$2::jsonb) AS result`, [legacy, payload]);
  expect(await scalar(`SELECT status AS result FROM "Payment" WHERE id=$1`, [legacy])).toBe("CONFIRMED");
  expect(await scalar(`SELECT count(*)::int AS result FROM "Subscription" WHERE "userId"='sub-user'`)).toBe(1);
  expect(await scalar(`SELECT EXTRACT(DAY FROM ("endsAt"-"startsAt"))::int AS result FROM "Subscription" WHERE "userId"='sub-user'`)).toBe(33);
  expect(await scalar(`SELECT "balanceCents" AS result FROM "User" WHERE id='sub-user'`)).toBe(100000);
});
