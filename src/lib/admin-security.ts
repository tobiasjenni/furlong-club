import crypto from "node:crypto";
import { appUrl } from "./config";
import { safeNext } from "./request";

export function safeAdminNext(input: unknown) {
  const next = safeNext(input, "/admin");
  return next === "/admin" || next.startsWith("/admin/") ? next : "/admin";
}
export function passkeySite() {
  const url = new URL(appUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Passkeys require HTTPS");
  return { origin: url.origin, rpID: url.hostname };
}
export function recoveryDigest(input: string) {
  const code = input.trim().replaceAll("-", "").toUpperCase();
  return /^[0-9A-F]{32}$/.test(code) ? crypto.createHash("sha256").update(code).digest("hex") : null;
}
export function recoveryCodes() {
  const codes = Array.from({ length: 8 }, () => crypto.randomBytes(16).toString("hex").toUpperCase().match(/.{8}/g)!.join("-"));
  return { codes, hashes: codes.map(code => recoveryDigest(code)!) };
}
