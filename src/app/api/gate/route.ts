import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { code } = body as { code?: string };

  const accessCode = process.env.ACCESS_CODE;

  // If ACCESS_CODE env var is not set, always allow (local dev convenience)
  if (!accessCode) {
    const res = NextResponse.json({ success: true });
    return res;
  }

  if (!code || code.trim() !== accessCode) {
    return NextResponse.json(
      { success: false, error: "Invalid access code" },
      { status: 401 }
    );
  }

  // Set the access cookie and return success
  const res = NextResponse.json({ success: true });
  res.cookies.set("dh_access", accessCode, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return res;
}
