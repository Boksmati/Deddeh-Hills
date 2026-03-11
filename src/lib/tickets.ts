/**
 * Ticket Purchase data model.
 * Stored in Redis as:
 *   tickets:{id}               → TicketPurchase
 *   tickets:layer1:total       → number (sum of amounts)
 *   tickets:layer2:total       → number (sum of villa counts)
 *   tickets:investor:{id}      → TicketPurchase[]
 */

export type TicketLayer = "layer1" | "layer2";

export interface TicketPurchase {
  id: string;
  investorId: string;
  investorName: string;
  investorEmail: string;
  layer: TicketLayer;
  /** Layer 1: USD amount invested */
  amount?: number;
  /** Layer 2: number of villas */
  villaCount?: number;
  /** Total cash committed */
  cashCommitted: number;
  /** Projected profit at exit */
  projectedProfit: number;
  status: "pending" | "confirmed" | "exited";
  /** Which development phase this ticket belongs to (1, 2, or 3) */
  phase?: 1 | 2 | 3;
  createdAt: string;
  updatedAt: string;
}

export function validateTicketPurchase(body: Partial<TicketPurchase>): string | null {
  if (!body.investorId) return "investorId required";
  if (!body.investorName) return "investorName required";
  if (!body.investorEmail) return "investorEmail required";
  if (!body.layer || !["layer1", "layer2"].includes(body.layer)) return "layer must be layer1 or layer2";
  if (body.layer === "layer1" && (!body.amount || body.amount <= 0)) return "amount required for layer1";
  if (body.layer === "layer2" && (!body.villaCount || body.villaCount <= 0)) return "villaCount required for layer2";
  if (!body.cashCommitted || body.cashCommitted <= 0) return "cashCommitted required";
  return null;
}
