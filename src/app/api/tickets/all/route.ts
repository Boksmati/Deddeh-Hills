import { NextRequest, NextResponse } from "next/server";
import { dbGet } from "@/lib/kv";
import type { TicketPurchase } from "@/lib/tickets";

function isAdmin(req: NextRequest): boolean {
  return req.cookies.get("dh_role")?.value === "admin";
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tickets = await dbGet<TicketPurchase[]>("tickets:all", []);
  return NextResponse.json(tickets);
}
