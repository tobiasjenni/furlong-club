import { isAdmin } from "@/lib/roles";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";
import { CLUB_COOKIE, clubGateEnabled, clubNext, gateExempt, gateAccountPath, gateMachineEndpoint, verifyClubAdmission } from "./lib/club-gate";
import { isMemberPath } from "./lib/member-routes";
import { clubMemberAdmitted } from "./lib/club-network-store";

function privateResponse(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const locked = clubGateEnabled();
  const publicRequest = gateExempt(path) && (["GET", "HEAD"].includes(req.method) || path === "/api/club-entry" || gateMachineEndpoint(path) || gateAccountPath(path));
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  const entrance = path === "/entrance" && ["GET", "HEAD"].includes(req.method);
  let member = false;
  // Personal sessions and guest invitations are separate. A revoked member
  // cannot fall back to guest admission. Remembered IPs never open the door.
  let admitted = !session && await verifyClubAdmission(req.cookies.get(CLUB_COOKIE)?.value);
  if (locked && session && (!publicRequest || entrance) && !(entrance && req.nextUrl.searchParams.get("reauth") === "1")) {
    try {
      member = await clubMemberAdmitted(session.uid, session.sv);
      admitted = member;
    } catch {
      if (path.startsWith("/api/") || !["GET", "HEAD"].includes(req.method)) {
        return privateResponse(NextResponse.json({ error: "Please sign in to continue." }, { status: 403 }));
      }
      if (!entrance) {
        const url = new URL("/entrance", req.url);
        url.searchParams.set("mode", "member");
        url.searchParams.set("next", clubNext(path + req.nextUrl.search));
        url.searchParams.set("reauth", "1");
        return privateResponse(NextResponse.redirect(url));
      }
    }
  }
  if (locked && entrance && member) {
    const next = req.nextUrl.searchParams.get("next");
    return privateResponse(NextResponse.redirect(new URL(next ? clubNext(next) : "/dashboard", req.url)));
  }
  if (locked && !publicRequest && !admitted) {
    if (path.startsWith("/api/") || !["GET", "HEAD"].includes(req.method)) return privateResponse(NextResponse.json({ error: "Club admission required." }, { status: 403 }));
    const url = new URL("/entrance", req.url);
    url.searchParams.set("next", path + req.nextUrl.search);
    return privateResponse(NextResponse.redirect(url));
  }
  const protectedPage = isMemberPath(path) || /^\/(?:admin|videos|checkout)(?:\/|$)/.test(path);
  if (protectedPage) {
    if (!session) {
      const url = new URL(locked ? "/entrance" : "/login", req.url);
      if (locked) url.searchParams.set("mode", "member");
      url.searchParams.set("next", path + req.nextUrl.search);
      return privateResponse(NextResponse.redirect(url));
    }
    if (path.startsWith("/admin") && !isAdmin(session.role)) return privateResponse(NextResponse.redirect(new URL("/dashboard", req.url)));
  }
  // Overwrite the internal layout hint, including a spoofed incoming value.
  const headers = new Headers(req.headers);
  headers.set("x-furlong-entrance", path === "/entrance" || (locked && path === "/login") ? "1" : "0");
  const response = NextResponse.next({ request: { headers } });
  return locked || protectedPage || path === "/entrance" ? privateResponse(response) : response;
}

export const config = {
  matcher: ["/((?!_next/static/|_next/image$).*)"],
};
