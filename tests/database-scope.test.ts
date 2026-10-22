import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AsyncLocalStorage } from "node:async_hooks";

const mocks = vi.hoisted(() => ({ context: vi.fn(), create: vi.fn() }));
vi.mock("@opennextjs/cloudflare", () => ({ getCloudflareContext: mocks.context }));
vi.mock("@prisma/client", () => ({ PrismaClient: class {
  user = { findUnique: vi.fn(async () => this) };
  constructor() { mocks.create(this); }
  $queryRaw() { return this; }
} }));
vi.mock("@prisma/adapter-neon", () => ({ PrismaNeonHTTP: class {} }));
vi.mock("@neondatabase/serverless", () => ({ neonConfig: {} }));

beforeEach(() => {
  vi.resetModules();
  mocks.create.mockClear();
  vi.stubEnv("DATABASE_DRIVER", "neon-http");
  vi.stubEnv("DATABASE_URL", "postgresql://test.invalid/db");
});
afterEach(() => vi.unstubAllEnvs());

it("creates no database client at module evaluation", async () => {
  await import("../src/lib/db");
  expect(mocks.create).not.toHaveBeenCalled();
});

it("reuses a client within a request and isolates overlapping Worker requests", async () => {
  const scope = new AsyncLocalStorage<{ ctx: object }>();
  mocks.context.mockImplementation(() => scope.getStore());
  const { db } = await import("../src/lib/db");
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const first = scope.run({ ctx: {} }, async () => {
    const initial = db.user;
    await pending;
    expect(db.user).toBe(initial);
    expect(db.$queryRaw`SELECT 1`).toBe(await initial.findUnique({ where: { id: "test" } }));
    return initial;
  });
  const second = await scope.run({ ctx: {} }, async () => db.user);
  release();
  expect(await first).not.toBe(second);
  expect(mocks.create).toHaveBeenCalledTimes(2);
});

it("does not silently fall back to a shared client outside a Worker request", async () => {
  mocks.context.mockImplementation(() => { throw new Error("No request context"); });
  const { db } = await import("../src/lib/db");
  expect(() => db.user).toThrow("No request context");
  expect(mocks.create).not.toHaveBeenCalled();
});
