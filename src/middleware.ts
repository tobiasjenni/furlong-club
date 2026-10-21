import { isAdmin } from "@/lib/roles";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "./lib/session";

function privateResponse(response: NextResponse) {
  response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function middleware(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return privateResponse(NextResponse.redirect(url));
  }
  if (req.nextUrl.pathname.startsWith("/admin") && !isAdmin(session.role)) {
    return privateResponse(NextResponse.redirect(new URL("/dashboard", req.url)));
  }
  return privateResponse(NextResponse.next());
}

export const config = {
  matcher: ["/dashboard/:path*", "/videos/:path*", "/account/:path*", "/wallet/:path*", "/checkout/:path*", "/admin/:path*", "/allocations/:path*", "/performance/:path*", "/activity/:path*", "/planner/:path*", "/membership/:path*", "/deposits/:path*", "/support/:path*"],
};
