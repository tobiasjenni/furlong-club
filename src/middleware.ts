import { isAdmin } from "@/lib/roles";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";
import { CLUB_COOKIE, clubCookieOptions, clubGateEnabled, clubNext, gateExempt, gateAccountPath, gateMachineEndpoint, signClubAdmission, verifyClubAdmission } from "./lib/club-gate";
import { isMemberPath } from "./lib/member-routes";
import { clubNetworkKey } from "./lib/club-network";
import { clubMemberAdmitted, clubNetworkAdmitted } from "./lib/club-network-store";

function privateResponse(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const locked = clubGateEnabled();
  const publicRequest = gateExempt(path) && (["GET", "HEAD"].includes(req.method) || path === "/api/club-entry" || gateMachineEndpoint(path) || gateAccountPath(path));
  // Always validate the cookie before routing, including public entrance requests.
  let admitted = await verifyClubAdmission(req.cookies.get(CLUB_COOKIE)?.value);
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  let renewed: string | undefined;
  const entrance = path === "/entrance" && ["GET", "HEAD"].includes(req.method);
  if (locked && !admitted && (!publicRequest || entrance)) {
    try {
      // A signed session alone is insufficient: recheck active status and
      // revocation before using an existing membership to open the entrance.
      if (session) admitted = await clubMemberAdmitted(session.uid, session.sv);
      if (!admitted) {
        const network = await clubNetworkKey(req.headers);
        if (network) admitted = await clubNetworkAdmitted(network);
      }
      if (admitted) renewed = await signClubAdmission();
    } catch {
      return privateResponse(NextResponse.json({ error: "The club entrance is temporarily unavailable. Please try again later." }, { status: 503 }));
    }
  }
  const finish = (response: NextResponse) => {
    if (renewed) response.cookies.set(CLUB_COOKIE, renewed, clubCookieOptions);
    return privateResponse(response);
  };
  // Returning visitors never see the invitation again, including old preview links.
  if (locked && entrance && admitted) {
    const next = req.nextUrl.searchParams.get("next");
    return finish(NextResponse.redirect(new URL(next ? clubNext(next) : session ? "/dashboard" : "/login", req.url)));
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
      const url = new URL("/login", req.url);
      url.searchParams.set("next", path + req.nextUrl.search);
      return finish(NextResponse.redirect(url));
    }
    if (path.startsWith("/admin") && !isAdmin(session.role)) return finish(NextResponse.redirect(new URL("/dashboard", req.url)));
  }
  // Overwrite the internal layout hint, including a spoofed incoming value.
  const headers = new Headers(req.headers);
  headers.set("x-furlong-entrance", path === "/entrance" ? "1" : "0");
  const response = NextResponse.next({ request: { headers } });
  return locked || protectedPage || path === "/entrance" ? finish(response) : response;
}

export const config = {
  matcher: ["/((?!_next/static/|_next/image$).*)"],
};
