import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";
import { type TicketPurchase, validateTicketPurchase } from "@/lib/tickets";

function isAuthorized(req: NextRequest): boolean {
  const role = req.cookies.get("dh_role")?.value;
  return role === "admin" || role === "investor";
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({})) as Partial<TicketPurchase>;
  const validationError = validateTicketPurchase(body);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const now = new Date().toISOString();
  const ticket: TicketPurchase = {
    id: crypto.randomUUID(),
    investorId: body.investorId!,
    investorName: body.investorName!,
    investorEmail: body.investorEmail!,
    layer: body.layer!,
    amount: body.amount,
    villaCount: body.villaCount,
    cashCommitted: body.cashCommitted!,
    projectedProfit: body.projectedProfit ?? 0,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  // Store individual ticket
  await dbSet(`tickets:${ticket.id}`, ticket);

  // Update investor list
  const investorTickets = await dbGet<TicketPurchase[]>(`tickets:investor:${ticket.investorId}`, []);
  investorTickets.push(ticket);
  await dbSet(`tickets:investor:${ticket.investorId}`, investorTickets);

  // Update layer totals
  if (ticket.layer === "layer1" && ticket.amount) {
    const current = await dbGet<number>("tickets:layer1:total", 0);
    await dbSet("tickets:layer1:total", current + ticket.amount);
  }
  if (ticket.layer === "layer2" && ticket.villaCount) {
    const current = await dbGet<number>("tickets:layer2:total", 0);
    await dbSet("tickets:layer2:total", current + ticket.villaCount);
  }

  // Update global registry (used by admin dashboard)
  const allTickets = await dbGet<TicketPurchase[]>("tickets:all", []);
  allTickets.push(ticket);
  await dbSet("tickets:all", allTickets);

  return NextResponse.json(ticket, { status: 201 });
}
