import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";
import type { StoredEvent } from "@/app/api/analytics/track/route";

function requireAdmin(req: NextRequest): NextResponse | null {
  const role = req.cookies.get("dh_role");
  if (role?.value !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

// GET /api/analytics/events — admin only
export async function GET(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const events = await dbGet<StoredEvent[]>("dh:analytics", []);
  // Return newest-first
  return NextResponse.json([...events].reverse());
}

// DELETE /api/analytics/events — clear all events
export async function DELETE(req: NextRequest) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  await dbSet("dh:analytics", []);
  return NextResponse.json({ ok: true });
}
