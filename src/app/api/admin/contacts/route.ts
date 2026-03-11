import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";

export interface CrmPayment {
  id: string;
  label: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: "pending" | "paid" | "overdue";
}

export interface CrmContact {
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

/** Maps CRM stages that imply a concrete lot status. lead/prospect → no change. */
const STAGE_TO_LOT_STATUS: Partial<Record<CrmContact["stage"], "reserved" | "under_contract" | "sold">> = {
  reserved: "reserved",
  under_contract: "under_contract",
  sold: "sold",
};

function isAdmin(req: NextRequest): boolean {
  return req.cookies.get("dh_role")?.value === "admin";
}

export async function GET(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const contacts = await dbGet<CrmContact[]>(KEY, []);
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const contacts = await dbGet<CrmContact[]>(KEY, []);
  const now = new Date().toISOString();
  const contact: CrmContact = {
    id: crypto.randomUUID(),
    name: (body.name as string) || "Unnamed",
    email: (body.email as string) || "",
    phone: body.phone,
    nationality: body.nationality,
    source: body.source,
    stage: body.stage || "lead",
    assignedLotId: body.assignedLotId ? Number(body.assignedLotId) : undefined,
    budget: body.budget ? Number(body.budget) : undefined,
    notes: body.notes,
    inviteToken: body.inviteToken,
    inviteRole: body.inviteRole,
    contractUploaded: false,
    payments: [],
    createdAt: now,
    updatedAt: now,
  };
  contacts.push(contact);
  await dbSet(KEY, contacts);
  return NextResponse.json(contact, { status: 201 });
}

export async function PUT(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({})) as Partial<CrmContact> & { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  let contacts = await dbGet<CrmContact[]>(KEY, []);
  contacts = contacts.map((c) =>
    c.id === body.id ? { ...c, ...body, id: c.id, updatedAt: new Date().toISOString() } : c
  );
  await dbSet(KEY, contacts);

  const updated = contacts.find((c) => c.id === body.id);

  // ── Sync lot status when stage changes to a reservable/sold status ──────────
  if (updated?.assignedLotId && body.stage) {
    const lotStatus = STAGE_TO_LOT_STATUS[body.stage];
    if (lotStatus) {
      const state = await dbGet<Record<string, unknown>>("state", {});
      const existing = Array.isArray(state.lotStatuses)
        ? (state.lotStatuses as [number, string][])
        : [];
      // Replace existing entry for this lot or append
      const synced = [
        ...existing.filter(([id]) => id !== updated.assignedLotId),
        [updated.assignedLotId, lotStatus] as [number, string],
      ];
      await dbSet("state", { ...state, lotStatuses: synced });
    }
  }

  return NextResponse.json(updated ?? {});
}

export async function DELETE(req: NextRequest) {
  if (!isAdmin(req)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const contacts = await dbGet<CrmContact[]>(KEY, []);
  await dbSet(KEY, contacts.filter((c) => c.id !== id));
  return NextResponse.json({ success: true });
}
