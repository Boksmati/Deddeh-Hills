import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";

interface StoredScenario {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  assignments: unknown[];
  lotStatuses: unknown[];
  investorSharePct: number;
  typeAssumptions?: unknown;
  investorModel?: unknown;
}

async function readScenarios(): Promise<StoredScenario[]> {
  return dbGet<StoredScenario[]>("scenarios", []);
}

async function writeScenarios(scenarios: StoredScenario[]): Promise<void> {
  return dbSet("scenarios", scenarios);
}

export async function GET() {
  return NextResponse.json(await readScenarios());
}

export async function POST(req: Request) {
  const body = (await req.json()) as StoredScenario;
  const scenarios = await readScenarios();
  const idx = scenarios.findIndex((s) => s.id === body.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    scenarios[idx] = { ...body, updatedAt: now };
  } else {
    scenarios.push({ ...body, updatedAt: now });
  }
  await writeScenarios(scenarios);
  return NextResponse.json({ ok: true, id: body.id });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const scenarios = (await readScenarios()).filter((s) => s.id !== id);
  await writeScenarios(scenarios);
  return NextResponse.json({ ok: true });
}
