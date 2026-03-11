import { NextRequest, NextResponse } from "next/server";
import { dbGet } from "@/lib/kv";
import { type TicketPurchase } from "@/lib/tickets";

function isAuthorized(req: NextRequest): boolean {
  const role = req.cookies.get("dh_role")?.value;
  return role === "admin" || role === "investor";
}

export async function GET(
  req: NextRequest,
  { params }: { params: { investorId: string } }
) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tickets = await dbGet<TicketPurchase[]>(
    `tickets:investor:${params.investorId}`,
    []
  );

  return NextResponse.json(tickets);
}
