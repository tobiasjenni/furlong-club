// An ephemeral software authenticator for server verification tests only.
// No test private key is embedded, saved or deployed as an enrolled credential.
import crypto from "node:crypto";
import { isoCBOR } from "@simplewebauthn/server/helpers";
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from "@simplewebauthn/server";
const hash = (value: string | Uint8Array) => crypto.createHash("sha256").update(value).digest();
export function passkeyFixture(origin: string, userId: string) {
  const idBytes = crypto.randomBytes(32), id = idBytes.toString("base64url");
  const pair = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = pair.publicKey.export({ format: "jwk" });
  const key = isoCBOR.encode(new Map<number, number | Uint8Array>([[1, 2], [3, -7], [-1, 1], [-2, new Uint8Array(Buffer.from(jwk.x!, "base64url"))], [-3, new Uint8Array(Buffer.from(jwk.y!, "base64url"))]]));
  const client = (challenge: string, type: string, url = origin) => Buffer.from(JSON.stringify({ type, challenge, origin: url, crossOrigin: false }));
  const authData = (flags: number, count: number, rp = new URL(origin).hostname) => {
    const counter = Buffer.alloc(4); counter.writeUInt32BE(count);
    return Buffer.concat([hash(rp), Buffer.from([flags]), counter]);
  };
  return {
    id,
    register(challenge: string, flags = 0x45, url = origin): RegistrationResponseJSON {
      const length = Buffer.alloc(2); length.writeUInt16BE(idBytes.length);
      const auth = Buffer.concat([authData(flags, 0), Buffer.alloc(16), length, idBytes, key]);
      const attestation = isoCBOR.encode(new Map<string, string | Uint8Array | Map<string, string>>([["fmt", "none"], ["authData", new Uint8Array(auth)], ["attStmt", new Map()]]));
      return { id, rawId: id, type: "public-key", clientExtensionResults: {}, response: { clientDataJSON: client(challenge, "webauthn.create", url).toString("base64url"), attestationObject: Buffer.from(attestation).toString("base64url"), transports: ["internal"] } };
    },
    authenticate(challenge: string, count = 1, flags = 0x05, url = origin, rp?: string): AuthenticationResponseJSON {
      const data = client(challenge, "webauthn.get", url), auth = authData(flags, count, rp);
      const signature = crypto.sign("sha256", Buffer.concat([auth, hash(data)]), pair.privateKey);
      return { id, rawId: id, type: "public-key", clientExtensionResults: {}, response: { clientDataJSON: data.toString("base64url"), authenticatorData: auth.toString("base64url"), signature: signature.toString("base64url"), userHandle: Buffer.from(userId).toString("base64url") } };
    },
  };
}
