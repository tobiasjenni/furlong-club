import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { clubGateEnabled, clubPasswordHash, clubNext, signClubAdmission, CLUB_COOKIE, clubCookieOptions } from "@/lib/club-gate";
import { rateLimit } from "@/lib/rate-limit";
import { clientIp } from "@/lib/request";
import { BodyLimitError, limitedText } from "@/lib/http-body";
import { clubNetworkKey } from "@/lib/club-network";
import { rememberClubNetwork } from "@/lib/club-network-store";

const response = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
export async function POST(request: Request) {
  const site = new URL(process.env.APP_URL || "https://furlong.club");
  if (request.headers.get("origin") !== site.origin || !request.headers.get("content-type")?.startsWith("application/json")) return response({ error: "Please enter through the club entrance." }, 403);
  if (!clubGateEnabled()) return response({ next: "/" });
  const hash = clubPasswordHash();
  if (!hash) return response({ error: "The club entrance is temporarily unavailable. Please try again later." }, 503);
  if (!await rateLimit(`club-entry:${await clientIp()}`, 10, 15 * 60 * 1000)) return response({ error: "Too many attempts. Please return in 15 minutes." }, 429);
  let input: { password?: unknown; next?: unknown };
  try {
    input = JSON.parse(await limitedText(request, 4096));
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error();
  } catch (error) { return response({ error: "Please enter the club password." }, error instanceof BodyLimitError ? 413 : 400); }
  if (typeof input.password !== "string" || new TextEncoder().encode(input.password).length > 72 || !await bcrypt.compare(input.password, hash)) return response({ error: "That password does not open the door. Please try again." }, 401);
  try {
    const network = await clubNetworkKey(request.headers);
    if (network) await rememberClubNetwork(network);
    const result = response({ next: clubNext(input.next) });
    result.cookies.set(CLUB_COOKIE, await signClubAdmission(), clubCookieOptions);
    return result;
  } catch {
    return response({ error: "The club entrance is temporarily unavailable. Please try again later." }, 503);
  }
}
