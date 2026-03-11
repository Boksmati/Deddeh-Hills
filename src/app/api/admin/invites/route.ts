import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";
import { randomBytes } from "crypto";

export interface InviteToken {
  token: string;
  role: "investor" | "customer";
  label: string;
  createdAt: string;
  expiresAt: string | null;
  usedAt: string | null;
  revokedAt: string | null;
}

async function readInvites(): Promise<InviteToken[]> {
  return dbGet<InviteToken[]>("invites", []);
}

async function writeInvites(invites: InviteToken[]): Promise<void> {
  return dbSet("invites", invites);
}

/** Require admin role cookie. */
function requireAdmin(req: NextRequest): NextResponse | null {
  const role = req.cookies.get("dh_role");
  if (role?.value !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

// GET /api/admin/invites — list all invites
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;
  return NextResponse.json(await readInvites());
}

// POST /api/admin/invites — create invite
export async function POST(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await req.json() as { role: "investor" | "customer"; label: string; expiresAt?: string };
  if (!body.role || !["investor", "customer"].includes(body.role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const token = randomBytes(18).toString("hex"); // 36-char hex token
  const invite: InviteToken = {
    token,
    role: body.role,
    label: body.label || `${body.role} invite`,
    createdAt: new Date().toISOString(),
    expiresAt: body.expiresAt ?? null,
    usedAt: null,
    revokedAt: null,
  };

  const invites = await readInvites();
  invites.push(invite);
  await writeInvites(invites);

  return NextResponse.json({ token, invite });
}

// DELETE /api/admin/invites?token=xxx — revoke
export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const invites = await readInvites();
  const idx = invites.findIndex((i) => i.token === token);
  if (idx < 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  invites[idx] = { ...invites[idx], revokedAt: new Date().toISOString() };
  await writeInvites(invites);

  return NextResponse.json({ ok: true });
}
