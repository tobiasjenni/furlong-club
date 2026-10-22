import { PrismaNeonHTTP } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { databaseFetch } from "./database-fetch";

// On Cloudflare Workers there is no native query engine or long-lived TCP pool, so production talks to
// Neon over its stateless HTTP driver (safe to share across requests). Locally and in CI we use plain Postgres.
function createClient() {
  if (process.env.DATABASE_DRIVER === "neon-http") {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    neonConfig.fetchFunction = databaseFetch;
    return new PrismaClient({ adapter: new PrismaNeonHTTP(url, { fetchOptions: { cache: "no-store" } }) });
  }
  return new PrismaClient();
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? createClient();

globalForPrisma.prisma = db;
