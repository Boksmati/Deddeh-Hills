import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { code } = body as { code?: string };

  const accessCode = process.env.ACCESS_CODE;
  const adminCode = process.env.ADMIN_CODE;

  // No ACCESS_CODE set — always allow (local dev convenience)
  if (!accessCode) {
    const res = NextResponse.json({ success: true, role: "admin" });
    res.cookies.set("dh_role", "admin", cookieOpts());
    return res;
  }

  if (!code) {
    return NextResponse.json({ success: false, error: "No code provided" }, { status: 401 });
  }

  const trimmed = code.trim();

  // ── Admin code check (higher privilege) ──────────────────────────────────
  if (adminCode && trimmed === adminCode) {
    const res = NextResponse.json({ success: true, role: "admin" });
    res.cookies.set("dh_access", accessCode, cookieOpts()); // also grants general access
    res.cookies.set("dh_role", "admin", cookieOpts());
    return res;
  }

  // ── General access code ───────────────────────────────────────────────────
  if (trimmed === accessCode) {
    const res = NextResponse.json({ success: true, role: "user" });
    res.cookies.set("dh_access", accessCode, cookieOpts());
    // Clear any lingering admin role cookie
    res.cookies.set("dh_role", "user", cookieOpts());
    return res;
  }

  return NextResponse.json(
    { success: false, error: "Invalid access code" },
    { status: 401 }
  );
}

function cookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}
