import { PrismaNeonHTTP } from "@prisma/adapter-neon";
import { PrismaClient } from "@prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import { databaseFetch } from "./database-fetch";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// On Cloudflare Workers there is no native query engine or long-lived TCP pool, so production talks to
// Neon over HTTP. The transport is stateless, but Prisma's lazy engine and query
// batching retain promises: a Worker must not share that client across requests.
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
const requestClients = new WeakMap<object, PrismaClient>();

function client() {
  if (process.env.DATABASE_DRIVER === "neon-http") {
    // OpenNext supplies the current request's ExecutionContext through its
    // request-local context. Weak keys release the client when that request ends.
    const { ctx } = getCloudflareContext();
    let instance = requestClients.get(ctx);
    if (!instance) {
      instance = createClient();
      requestClients.set(ctx, instance);
    }
    return instance;
  }
  // Local Node servers and command-line jobs can reuse their normal pool.
  return globalForPrisma.prisma ??= createClient();
}

// Preserve the existing model/tagged-query API without opening a client during
// module evaluation or carrying an authenticated query into another request.
export const db = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = client();
    const value = Reflect.get(instance, property, instance);
    return typeof value === "function" ? value.bind(instance) : value;
  },
});
