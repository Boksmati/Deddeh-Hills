import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "scenarios.json");

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

function readScenarios(): StoredScenario[] {
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function writeScenarios(scenarios: StoredScenario[]) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(scenarios, null, 2));
  } catch (e) {
    console.error("Failed to write scenarios file:", e);
  }
}

// GET /api/scenarios — list all
export async function GET() {
  return NextResponse.json(readScenarios());
}

// POST /api/scenarios — create or update (upsert by id)
export async function POST(req: Request) {
  const body = await req.json() as StoredScenario;
  const scenarios = readScenarios();
  const idx = scenarios.findIndex((s) => s.id === body.id);
  const now = new Date().toISOString();
  if (idx >= 0) {
    scenarios[idx] = { ...body, updatedAt: now };
  } else {
    scenarios.push({ ...body, updatedAt: now });
  }
  writeScenarios(scenarios);
  return NextResponse.json({ ok: true, id: body.id });
}

// DELETE /api/scenarios?id=xxx — delete one
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const scenarios = readScenarios().filter((s) => s.id !== id);
  writeScenarios(scenarios);
  return NextResponse.json({ ok: true });
}
