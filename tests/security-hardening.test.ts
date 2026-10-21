import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { SignJWT } from "jose";
import { afterEach, describe, expect, it, vi } from "vitest";
import { limitedText, BodyLimitError } from "@/lib/http-body";
import { matchesPassword } from "@/lib/passwords";
import { signAdminConfirmation, verifyAdminConfirmation } from "@/lib/admin-session";
import { verifyNowPaymentsSignature } from "@/lib/payments/nowpayments";
import { assertExistingOwner } from "../prisma/owner-bootstrap";

afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe("webhook resource limits", () => {
  const request = (chunks: Uint8Array[]) => new Request("https://example.com", { method: "POST", body: new ReadableStream({ start(controller) { for (const chunk of chunks) controller.enqueue(chunk); controller.close(); } }), duplex: "half" } as RequestInit);
  it("limits chunked bodies by bytes and cancels the stream on overflow", async () => {
    const cancelled = vi.fn();
    const stream = new ReadableStream({ pull(c) { c.enqueue(new Uint8Array(8)); }, cancel: cancelled });
    await expect(limitedText(new Request("https://example.com", { method: "POST", body: stream, duplex: "half" } as RequestInit), 10)).rejects.toBeInstanceOf(BodyLimitError);
    expect(cancelled).toHaveBeenCalledOnce();
  });
  it("counts UTF-8 bytes rather than characters and decodes split characters", async () => {
    const encoded = new TextEncoder().encode("éé");
    expect(await limitedText(request([encoded.slice(0, 1), encoded.slice(1)]), 4)).toBe("éé");
    await expect(limitedText(request([encoded]), 3)).rejects.toBeInstanceOf(BodyLimitError);
  });
  it("rejects oversized declared bodies before reading and invalid UTF-8", async () => {
    await expect(limitedText(new Request("https://example.com", { method: "POST", headers: { "content-length": "100" }, body: "a" }), 10)).rejects.toBeInstanceOf(BodyLimitError);
    await expect(limitedText(request([new Uint8Array([255])]), 10)).rejects.toThrow();
  });
  it("rejects excessive nesting without throwing even with a signature-shaped header", () => {
    const raw = '{"a":'.repeat(1000) + '0' + '}'.repeat(1000);
    expect(verifyNowPaymentsSignature(raw, "a".repeat(128), "secret")).toBeNull();
    expect(verifyNowPaymentsSignature("{}", "not-hex", "secret")).toBeNull();
  });
});

describe("password confirmation and owner setup", () => {
  it("rejects bcrypt truncation in current-password confirmations, including Unicode", async () => {
    const password = "é".repeat(36);
    const hash = await bcrypt.hash(password, 4);
    expect(await matchesPassword(password, hash)).toBe(true);
    expect(await matchesPassword(password + "extra", hash)).toBe(false);
    expect(await matchesPassword("", hash)).toBe(false);
  });
  it("never promotes an existing member or admin by configured email", () => {
    for (const role of ["USER", "ADMIN"]) expect(() => assertExistingOwner({ role, status: "ACTIVE" })).toThrow("blocked");
    expect(() => assertExistingOwner({ role: "SUPER_ADMIN", status: "SUSPENDED" })).toThrow("blocked");
    expect(() => assertExistingOwner({ role: "SUPER_ADMIN", status: "ACTIVE" })).not.toThrow();
    expect(() => assertExistingOwner(null)).not.toThrow();
  });
});

describe("short admin confirmation", () => {
  const user = { id: "admin", sessionVersion: 2 };
  it("expires after 15 minutes and binds to the user, session and revocation version", async () => {
    vi.stubEnv("AUTH_SECRET", "s".repeat(40)); vi.useFakeTimers();
    const token = await signAdminConfirmation(user, "session-A");
    expect(await verifyAdminConfirmation(token, user, "session-A")).toBe(true);
    expect(await verifyAdminConfirmation(token, user, "session-B")).toBe(false);
    expect(await verifyAdminConfirmation(token, { ...user, id: "other" }, "session-A")).toBe(false);
    expect(await verifyAdminConfirmation(token, { ...user, sessionVersion: 3 }, "session-A")).toBe(false);
    vi.advanceTimersByTime(15 * 60 * 1000);
    expect(await verifyAdminConfirmation(token, user, "session-A")).toBe(false);
  });
  it("rejects an ordinary signed login token and a tampered confirmation", async () => {
    vi.stubEnv("AUTH_SECRET", "s".repeat(40));
    const token = await new SignJWT({ uid: user.id, sv: 2, sid: crypto.createHash("sha256").update("session-A").digest("hex") }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("15m").sign(new TextEncoder().encode(process.env.AUTH_SECRET));
    expect(await verifyAdminConfirmation(token, user, "session-A")).toBe(false);
    expect(await verifyAdminConfirmation("forged", user, "session-A")).toBe(false);
  });
});
