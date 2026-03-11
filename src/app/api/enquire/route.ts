import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";

// Re-use the same CRM contact shape from admin/contacts
interface CrmPayment {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: "pending" | "paid" | "overdue";
}

interface CrmContact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  nationality?: string;
  source?: "website" | "referral" | "agent" | "social" | "direct" | "other";
  stage: "lead" | "prospect" | "reserved" | "under_contract" | "sold";
  assignedLotId?: number;
  budget?: number;
  notes?: string;
  inviteToken?: string;
  inviteRole?: "customer" | "investor";
  contractUploaded?: boolean;
  payments: CrmPayment[];
  createdAt: string;
  updatedAt: string;
}

const KEY = "crm_contacts";

/** Public endpoint — no auth required. Creates a "lead" CRM contact from the customer enquiry form. */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as {
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
    unitId?: string;
    lotId?: number;
    unitLabel?: string;
  };

  // Basic server-side validation
  if (!body.name?.trim() || !body.email?.trim()) {
    return NextResponse.json({ error: "name and email are required" }, { status: 400 });
  }

  const contacts = await dbGet<CrmContact[]>(KEY, []);
  const now = new Date().toISOString();

  const contact: CrmContact = {
    id: crypto.randomUUID(),
    name: body.name.trim(),
    email: body.email.trim().toLowerCase(),
    phone: body.phone?.trim() || undefined,
    source: "website",
    stage: "lead",
    assignedLotId: body.lotId ? Number(body.lotId) : undefined,
    notes: [
      body.unitLabel ? `Enquired about: ${body.unitLabel}` : undefined,
      body.message?.trim() || undefined,
    ].filter(Boolean).join("\n\n") || undefined,
    contractUploaded: false,
    payments: [],
    createdAt: now,
    updatedAt: now,
  };

  contacts.push(contact);
  await dbSet(KEY, contacts);

  return NextResponse.json({ ok: true }, { status: 201 });
}
