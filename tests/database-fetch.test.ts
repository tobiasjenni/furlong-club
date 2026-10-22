import { afterEach, expect, it, vi } from "vitest";
import { databaseFetch } from "../src/lib/database-fetch";
afterEach(() => vi.unstubAllGlobals());
it("gives each request its own deadline and bypasses response caching", async () => {
  const send = vi.fn().mockResolvedValue(new Response("ok"));
  vi.stubGlobal("fetch", send);
  await databaseFetch("https://database.invalid/sql", { method:"POST", body:"private SQL", headers:{"X-Test":"preserved"} });
  await databaseFetch("https://database.invalid/sql");
  const first = send.mock.calls[0][1], second = send.mock.calls[1][1];
  expect(first).toMatchObject({ cache:"no-store", method:"POST", headers:{"X-Test":"preserved"} });
  expect(first.signal).not.toBe(second.signal);
  expect(second.signal.aborted).toBe(false);
});
it("honors an upstream cancellation without retrying a database operation", async () => {
  const controller = new AbortController();
  controller.abort();
  const send = vi.fn(async (_input, init) => { if(init.signal.aborted) throw new DOMException("Aborted", "AbortError"); return new Response(); });
  vi.stubGlobal("fetch", send);
  await expect(databaseFetch("https://database.invalid/sql", {signal:controller.signal})).rejects.toThrow("Aborted");
  expect(send).toHaveBeenCalledTimes(1);
});
it("ends a stalled database request without replaying an ambiguous write", async () => {
  const send = vi.fn((_input, init) => new Promise<Response>((_, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason), {once:true})));
  vi.stubGlobal("fetch", send);
  await expect(databaseFetch("https://database.invalid/sql", {method:"POST"}, 5)).rejects.toThrow();
  expect(send).toHaveBeenCalledTimes(1);
});
