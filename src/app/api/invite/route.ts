import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";
import type { InviteToken } from "@/app/api/admin/invites/route";

// GET /api/invite?token=xxx — validate token and return role
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const invites = await dbGet<InviteToken[]>("invites", []);
  const invite = invites.find((i) => i.token === token);

  if (!invite) return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  if (invite.revokedAt) return NextResponse.json({ error: "Revoked" }, { status: 410 });
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    return NextResponse.json({ error: "Expired" }, { status: 410 });
  }

  // Mark as used (first use only)
  if (!invite.usedAt) {
    const idx = invites.findIndex((i) => i.token === token);
    invites[idx] = { ...invite, usedAt: new Date().toISOString() };
    await dbSet("invites", invites);
  }

  // Return JSON with destination — the client navigates after receiving cookies.
  // Redirecting from this endpoint causes a cross-origin redirect when the
  // browser accesses via 127.0.0.1 but Next.js normalises to localhost,
  // which fails fetch() CORS checks and lands in the catch block.
  const accessCode = process.env.ACCESS_CODE ?? "open";
  const destination = invite.role === "investor" ? "/investor" : "/customer";

  const res = NextResponse.json({ destination });
  const opts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
  res.cookies.set("dh_access", accessCode, opts);
  res.cookies.set("dh_role", invite.role, opts);

  return res;
}
