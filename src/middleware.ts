import { isAdmin } from "@/lib/roles";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";
import { CLUB_COOKIE, clubGateEnabled, gateExempt, gateMachineEndpoint, verifyClubAdmission } from "./lib/club-gate";
import { isMemberPath } from "./lib/member-routes";

function privateResponse(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const locked = clubGateEnabled();
  const publicRequest = gateExempt(path) && (["GET", "HEAD"].includes(req.method) || path === "/api/club-entry" || gateMachineEndpoint(path));
  if (locked && !publicRequest && !await verifyClubAdmission(req.cookies.get(CLUB_COOKIE)?.value)) {
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
      return privateResponse(NextResponse.redirect(url));
    }
    if (path.startsWith("/admin") && !isAdmin(session.role)) return privateResponse(NextResponse.redirect(new URL("/dashboard", req.url)));
  }
  // Overwrite the internal layout hint, including a spoofed incoming value.
  const headers = new Headers(req.headers);
  headers.set("x-furlong-entrance", path === "/entrance" ? "1" : "0");
  const response = NextResponse.next({ request: { headers } });
  return locked || protectedPage || path === "/entrance" ? privateResponse(response) : response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
