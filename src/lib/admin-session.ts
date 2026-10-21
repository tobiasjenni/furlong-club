import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const ADMIN_COOKIE = "fc_admin_confirmation";
export const ADMIN_CONFIRMATION_SECONDS = 15 * 60;
export const ADMIN_PASSWORD_COOKIE = "fc_admin_password";
export const ADMIN_PASSWORD_SECONDS = 5 * 60;
const audience = "furlong-admin-confirmation";
const issuer = "furlong-club";
type Identity = { id: string; sessionVersion: number };
function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Admin authentication is unavailable");
  return new TextEncoder().encode(secret);
}
export const sessionFingerprint = (session: string) => crypto.createHash("sha256").update(session).digest("hex");

export async function signAdminConfirmation(user: Identity, session: string, factor: "passkey" | "recovery") {
  return new SignJWT({ uid: user.id, sv: user.sessionVersion, sid: sessionFingerprint(session), factor })
    .setProtectedHeader({ alg: "HS256" }).setIssuer(issuer).setAudience(audience)
    .setIssuedAt().setExpirationTime(`${ADMIN_CONFIRMATION_SECONDS}s`).sign(key());
}

export async function verifyAdminConfirmation(token: string | undefined, user: Identity, session: string | undefined) {
  if (!token || !session || token.length > 2048) return false;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], issuer, audience, maxTokenAge: ADMIN_CONFIRMATION_SECONDS });
    return payload.uid === user.id && payload.sv === user.sessionVersion && payload.sid === sessionFingerprint(session) && ["passkey", "recovery"].includes(String(payload.factor));
  } catch { return false; }
}

export async function signAdminPassword(user: Identity, session: string, seconds = ADMIN_PASSWORD_SECONDS) {
  return new SignJWT({ uid: user.id, sv: user.sessionVersion, sid: sessionFingerprint(session) })
    .setProtectedHeader({ alg: "HS256" }).setIssuer(issuer).setAudience("furlong-admin-password")
    .setIssuedAt().setExpirationTime(`${Math.max(1, Math.min(ADMIN_PASSWORD_SECONDS, seconds))}s`).sign(key());
}

export async function verifyAdminPassword(token: string | undefined, user: Identity, session: string | undefined) {
  if (!token || !session || token.length > 2048) return false;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], issuer, audience: "furlong-admin-password", maxTokenAge: ADMIN_PASSWORD_SECONDS });
    return payload.uid === user.id && payload.sv === user.sessionVersion && payload.sid === sessionFingerprint(session);
  } catch { return false; }
}
