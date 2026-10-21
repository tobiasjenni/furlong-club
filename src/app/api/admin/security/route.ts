import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { decodeJwt } from "jose";
import { generateAuthenticationOptions, generateRegistrationOptions, verifyAuthenticationResponse, verifyRegistrationResponse,
  type AuthenticationResponseJSON, type RegistrationResponseJSON, type AuthenticatorTransport } from "@simplewebauthn/server";
import { currentUser, adminConfirmed, startSession } from "@/lib/auth";
import { ADMIN_COOKIE, ADMIN_CONFIRMATION_SECONDS, ADMIN_PASSWORD_COOKIE, sessionFingerprint, signAdminConfirmation, signAdminReauthenticationGrant, verifyAdminReauthenticationGrant } from "@/lib/admin-session";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/session";
import { db } from "@/lib/db";
import { isAdmin } from "@/lib/roles";
import { limitedText } from "@/lib/http-body";
import { rateLimit } from "@/lib/rate-limit";
import { passkeySite, recoveryCodes, recoveryDigest } from "@/lib/admin-security";

const response = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const transports = (values: unknown): AuthenticatorTransport[] => Array.isArray(values) ? values.filter((x): x is AuthenticatorTransport => typeof x === "string" && ["usb", "nfc", "ble", "internal", "hybrid", "smart-card"].includes(x)) : [];

export async function POST(request: Request) {
  const site = passkeySite();
  if (request.headers.get("origin") !== site.origin || !request.headers.get("content-type")?.startsWith("application/json")) return response({ error: "This request must come from the club website." }, 403);
  const user = await currentUser();
  if (!user || !isAdmin(user.role)) return response({ error: "Admin access required." }, 403);
  const store = await cookies();
  const session = store.get(SESSION_COOKIE)?.value;
  if (!session || !await verifyAdminReauthenticationGrant(store.get(ADMIN_PASSWORD_COOKIE)?.value, user, session)) return response({ error: "Confirm your password again before continuing.", reauthenticate: true }, 401);
  // The token was verified above. Keep its original deadline when rebinding after
  // a security change; repeated device changes must not extend password freshness.
  const passwordDeadline = Number(decodeJwt(store.get(ADMIN_PASSWORD_COOKIE)!.value).exp);
  if (!await rateLimit(`admin-security:${user.id}`, 30, 15 * 60 * 1000)) return response({ error: "Too many attempts. Try again in 15 minutes." }, 429);
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(await limitedText(request, 32 * 1024));
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
  } catch { return response({ error: "Invalid security request." }, 400); }
  const sid = sessionFingerprint(session);
  const commit = async (operation: string, data: object, hashes: string[] = []) => (await db.$queryRaw<{ result: string }[]>`SELECT admin_security_commit(${user.id},${user.sessionVersion}::integer,${operation},${JSON.stringify(data)}::jsonb,${JSON.stringify(hashes)}::jsonb,${crypto.randomUUID()}) AS result`)[0]?.result;
  const finish = async (factor: "passkey" | "recovery", changed: boolean, codes?: string[], grant = true) => {
    const fresh = await db.user.findUnique({ where: { id: user.id } });
    if (!fresh || !isAdmin(fresh.role) || fresh.status !== "ACTIVE" || fresh.sessionVersion !== user.sessionVersion + (changed ? 1 : 0)) return response({ error: "Your account changed. Sign in again." }, 409);
    if (changed) await startSession(fresh);
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    if (!token) return response({ error: "Sign in again." }, 401);
    const remaining = Math.floor(passwordDeadline - Date.now() / 1000);
    if (changed && remaining > 0) (await cookies()).set(ADMIN_PASSWORD_COOKIE, await signAdminReauthenticationGrant(fresh, token, remaining), { ...sessionCookieOptions, maxAge: remaining });
    if (grant) (await cookies()).set(ADMIN_COOKIE, await signAdminConfirmation(fresh, token, factor), { ...sessionCookieOptions, maxAge: ADMIN_CONFIRMATION_SECONDS });
    return response({ ok: true, needsVerification: !grant, ...(codes ? { recoveryCodes: codes } : {}) });
  };
  try {
    if (input.action === "options") {
      const kind = input.kind === "register" ? "register" : input.kind === "authenticate" ? "authenticate" : null;
      if (!kind) return response({ error: "Choose a valid security action." }, 400);
      const keys = await db.adminPasskey.findMany({ where: { userId: user.id } });
      const confirmed = await adminConfirmed(user);
      if (kind === "register" && keys.length && !confirmed) return response({ error: "Verify an existing passkey or recovery code before adding another device." }, 403);
      const credentials = keys.map(k => ({ id: k.id, transports: transports(k.transports) }));
      const options = kind === "register" ? await generateRegistrationOptions({
        rpName: "Furlong Club Admin", rpID: site.rpID, userName: user.email, userDisplayName: user.name || user.email,
        userID: new TextEncoder().encode(user.id), attestationType: "none", supportedAlgorithmIDs: [-7, -257],
        excludeCredentials: credentials, authenticatorSelection: { residentKey: "preferred", userVerification: "required" }, timeout: 60000,
      }) : await generateAuthenticationOptions({ rpID: site.rpID, allowCredentials: credentials, userVerification: "required", timeout: 60000 });
      const id = crypto.randomUUID();
      const saved = (await db.$queryRaw<{ saved: boolean }[]>`SELECT admin_security_challenge(${user.id},${user.sessionVersion}::integer,${sid},${kind},${id},${options.challenge},${confirmed}) AS saved`)[0]?.saved;
      return saved ? response({ id, options }) : response({ error: "The device limit or account state changed. Reload and try again." }, 409);
    }
    if (input.action === "register" || input.action === "authenticate") {
      if (typeof input.id !== "string" || !/^[a-f0-9-]{36}$/i.test(input.id) || !input.credential || typeof input.credential !== "object") return response({ error: "Invalid device response." }, 400);
      const challenge = (await db.$queryRaw<{ challenge: string; initial: boolean }[]>`SELECT * FROM admin_consume_challenge(${user.id},${user.sessionVersion}::integer,${sid},${input.id},${input.action})`)[0];
      if (!challenge) return response({ error: "This request expired or was already used. Try again." }, 400);
      if (input.action === "register") {
        if (!challenge.initial && !await adminConfirmed(user)) return response({ error: "Confirm admin access again." }, 403);
        const verified = await verifyRegistrationResponse({ response: input.credential as RegistrationResponseJSON, expectedChallenge: challenge.challenge,
          expectedOrigin: site.origin, expectedRPID: site.rpID, requireUserPresence: true, requireUserVerification: true, supportedAlgorithmIDs: [-7, -257] });
        if (!verified.verified) return response({ error: "The passkey could not be verified." }, 400);
        const info = verified.registrationInfo;
        const codes = challenge.initial ? recoveryCodes() : null;
        const result = await commit("register", { id: info.credential.id, publicKey: Buffer.from(info.credential.publicKey).toString("base64url"), counter: info.credential.counter,
          transports: transports(info.credential.transports), backedUp: info.credentialBackedUp, label: String(input.label || "My passkey").trim().slice(0, 80) || "My passkey", initial: challenge.initial }, codes?.hashes);
        if (result !== "saved") return response({ error: "Passkey setup changed or the device is already registered. Reload before retrying." }, 409);
        // Registration alone is not a login. Require an assertion or a recovery
        // code before granting privileged access with the newly created device.
        return finish("passkey", true, codes?.codes, false);
      }
      const supplied = input.credential as AuthenticationResponseJSON;
      const credential = typeof supplied.id === "string" ? await db.adminPasskey.findFirst({ where: { id: supplied.id, userId: user.id } }) : null;
      if (!credential) return response({ error: "This passkey does not belong to this admin account." }, 400);
      // If the authenticator supplies a handle, it must match this authenticated user.
      if (supplied.response?.userHandle && supplied.response.userHandle !== Buffer.from(user.id).toString("base64url")) return response({ error: "Incorrect passkey account." }, 400);
      const verified = await verifyAuthenticationResponse({ response: supplied, expectedChallenge: challenge.challenge, expectedOrigin: site.origin, expectedRPID: site.rpID,
        requireUserVerification: true, credential: { id: credential.id, publicKey: new Uint8Array(Buffer.from(credential.publicKey, "base64url")), counter: Number(credential.counter), transports: transports(credential.transports) } });
      if (!verified.verified || !verified.authenticationInfo.userVerified) return response({ error: "The device could not be verified." }, 400);
      const result = await commit("authenticate", { id: credential.id, oldCounter: Number(credential.counter), counter: verified.authenticationInfo.newCounter, backedUp: verified.authenticationInfo.credentialBackedUp });
      return result === "saved" ? finish("passkey", false) : response({ error: "The account or device changed. Try again." }, 409);
    }
    if (input.action === "recover") {
      if (!await rateLimit(`admin-recovery:${user.id}`, 5, 15 * 60 * 1000)) return response({ error: "Too many recovery attempts. Try again in 15 minutes." }, 429);
      const hash = recoveryDigest(typeof input.code === "string" ? input.code : "");
      if (!hash || await commit("recover", { hash }) !== "saved") return response({ error: "This recovery code is invalid or was already used." }, 400);
      return finish("recovery", true);
    }
    if (input.action === "remove" || input.action === "rotate_codes") {
      if (!await adminConfirmed(user)) return response({ error: "Verify your passkey or recovery code first." }, 403);
      const codes = input.action === "rotate_codes" ? recoveryCodes() : null;
      if (input.action === "remove" && (typeof input.credentialId !== "string" || input.credentialId.length > 2048)) return response({ error: "Invalid passkey." }, 400);
      const result = await commit(input.action, { id: input.credentialId }, codes?.hashes);
      if (result !== "saved") return response({ error: result === "last_key" ? "Add another passkey before removing your last one." : "Your security settings changed. Reload and try again." }, 409);
      const factor = decodeJwt(store.get(ADMIN_COOKIE)!.value).factor === "recovery" ? "recovery" : "passkey";
      return finish(factor, true, codes?.codes);
    }
    return response({ error: "Choose a valid security action." }, 400);
  } catch {
    // Never return credential payloads, recovery codes or raw provider/DB errors.
    return response({ error: "Device verification could not be completed. Check the device prompt and try again." }, 400);
  }
}
