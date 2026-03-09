import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Routes that are always public (no access gate). */
const PUBLIC_PREFIXES = ["/gate", "/api/gate", "/_next", "/favicon.ico"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public routes
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const accessCode = process.env.ACCESS_CODE;

  // If no ACCESS_CODE is set in env, skip the gate entirely (local dev convenience)
  if (!accessCode) {
    return NextResponse.next();
  }

  // Check the access cookie
  const cookie = request.cookies.get("dh_access");
  if (cookie?.value === accessCode) {
    return NextResponse.next();
  }

  // Not authenticated — redirect to gate, preserving the intended destination
  const gateUrl = request.nextUrl.clone();
  gateUrl.pathname = "/gate";
  gateUrl.search = "";
  if (pathname !== "/") {
    gateUrl.searchParams.set("from", pathname);
  }
  return NextResponse.redirect(gateUrl);
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets.
     * The PUBLIC_PREFIXES check above handles /gate and /api/gate.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
