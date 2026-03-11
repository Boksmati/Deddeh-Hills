import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// GET /api/me — returns the current user's role from the httpOnly cookie
export function GET(req: NextRequest) {
  const role = req.cookies.get("dh_role")?.value ?? null;
  return NextResponse.json({ role });
}
