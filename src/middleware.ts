import { isAdmin } from "@/lib/roles";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";
import { CLUB_COOKIE, clubCookieOptions, clubGateEnabled, clubNext, gateExempt, gateMachineEndpoint, signClubAdmission, verifyClubAdmission } from "./lib/club-gate";
import { isMemberPath } from "./lib/member-routes";
import { clubNetworkKey } from "./lib/club-network";
import { clubNetworkAdmitted } from "./lib/club-network-store";

function privateResponse(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const locked = clubGateEnabled();
  const publicRequest = gateExempt(path) && (["GET", "HEAD"].includes(req.method) || path === "/api/club-entry" || gateMachineEndpoint(path));
  // Always validate the cookie before routing, including public entrance requests.
  const network = await clubNetworkKey(req.headers);
  let admitted = await verifyClubAdmission(req.cookies.get(CLUB_COOKIE)?.value, network);
  let renewed: string | undefined;
  const entrance = path === "/entrance" && ["GET", "HEAD"].includes(req.method);
  if (locked && !admitted && network && (!publicRequest || entrance)) {
    try {
      admitted = await clubNetworkAdmitted(network);
      if (admitted) renewed = await signClubAdmission(network);
    } catch {
      return privateResponse(NextResponse.json({ error: "The club entrance is temporarily unavailable. Please try again later." }, { status: 503 }));
    }
  }
  const finish = (response: NextResponse) => {
    if (renewed) response.cookies.set(CLUB_COOKIE, renewed, clubCookieOptions);
    return privateResponse(response);
  };
  // A public artwork preview never grants admission to any other route.
  if (locked && entrance && admitted && req.nextUrl.searchParams.get("preview") !== "1") {
    return finish(NextResponse.redirect(new URL(clubNext(req.nextUrl.searchParams.get("next")), req.url)));
  }
  if (locked && !publicRequest && !admitted) {
    if (path.startsWith("/api/") || !["GET", "HEAD"].includes(req.method)) return privateResponse(NextResponse.json({ error: "Club admission required." }, { status: 403 }));
    const url = new URL("/entrance", req.url);
    url.searchParams.set("next", path + req.nextUrl.search);
    return privateResponse(NextResponse.redirect(url));
  }
  const protectedPage = isMemberPath(path) || /^\/(?:admin|videos|checkout)(?:\/|$)/.test(path);
  if (protectedPage) {
    const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
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
