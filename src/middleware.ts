import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Routes that are always public — no authentication or role required.
 * Landing page ("/") is handled separately as an exact match.
 */
const PUBLIC_PREFIXES = [
  "/gate",
  "/api/gate",
  "/invite",
  "/api/invite",
  "/api/me",               // role endpoint — returns null for unauthenticated callers
  "/api/state",            // lot/project data — needed by gate + customer page
  "/api/enquire",          // customer enquiry form — creates CRM lead, no auth needed
  "/api/analytics/track",  // write-only event tracking — public so invite visitors are recorded
  "/_next",
  "/favicon.ico",
];

/** Routes that require dh_role === "admin". */
const ADMIN_ONLY_PREFIXES = [
  "/admin",
  "/simulator",
  "/assumptions",
  "/status",
];

/** Routes that require dh_role === "investor" OR "admin". */
const INVESTOR_PREFIXES = ["/investor"];

function redirectToGate(request: NextRequest, from?: string) {
  const gateUrl = request.nextUrl.clone();
  gateUrl.pathname = "/gate";
  gateUrl.search = "";
  if (from && from !== "/") gateUrl.searchParams.set("from", from);
  return NextResponse.redirect(gateUrl);
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Always public ──────────────────────────────────────────────────────────
  if (PUBLIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const role = request.cookies.get("dh_role")?.value;

  // ── Admin-only routes ──────────────────────────────────────────────────────
  if (ADMIN_ONLY_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (role === "admin") return NextResponse.next();
    return redirectToGate(request, pathname);
  }

  // ── Investor routes (investor or admin) ────────────────────────────────────
  if (INVESTOR_PREFIXES.some((p) => pathname.startsWith(p))) {
    if (role === "investor" || role === "admin") return NextResponse.next();
    return redirectToGate(request, pathname);
  }

  // ── Other API routes — allow if any authenticated role is set ───────────────
  if (pathname.startsWith("/api/")) {
    if (role) return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── Local dev convenience — skip gate if ACCESS_CODE not configured ─────────
  if (!process.env.ACCESS_CODE) return NextResponse.next();

  // ── Any other route — require some authentication ──────────────────────────
  if (role) return NextResponse.next();
  return redirectToGate(request, pathname);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
