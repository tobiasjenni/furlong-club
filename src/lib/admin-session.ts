import crypto from "node:crypto";
import { SignJWT, jwtVerify } from "jose";

export const ADMIN_COOKIE = "fc_admin_confirmation";
export const ADMIN_CONFIRMATION_SECONDS = 15 * 60;
const audience = "furlong-admin-confirmation";
const issuer = "furlong-club";
type Identity = { id: string; sessionVersion: number };
function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("Admin authentication is unavailable");
  return new TextEncoder().encode(secret);
}
const fingerprint = (session: string) => crypto.createHash("sha256").update(session).digest("hex");

export async function signAdminConfirmation(user: Identity, session: string) {
  return new SignJWT({ uid: user.id, sv: user.sessionVersion, sid: fingerprint(session) })
    .setProtectedHeader({ alg: "HS256" }).setIssuer(issuer).setAudience(audience)
    .setIssuedAt().setExpirationTime(`${ADMIN_CONFIRMATION_SECONDS}s`).sign(key());
}

export async function verifyAdminConfirmation(token: string | undefined, user: Identity, session: string | undefined) {
  if (!token || !session || token.length > 2048) return false;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"], issuer, audience, maxTokenAge: ADMIN_CONFIRMATION_SECONDS });
    return payload.uid === user.id && payload.sv === user.sessionVersion && payload.sid === fingerprint(session);
  } catch { return false; }
}
