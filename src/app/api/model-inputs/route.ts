import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";

// ?scenario=default  → model-inputs-default (locked baseline set by admin)
// (no param)         → model-inputs (working / investor scenario)

function kvKey(req: Request) {
  const url = new URL(req.url);
  return url.searchParams.get("scenario") === "default"
    ? "model-inputs-default"
    : "model-inputs";
}

export async function GET(req: Request) {
  const data = await dbGet<Record<string, unknown> | null>(kvKey(req), null);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  await dbSet(kvKey(req), body);
  return NextResponse.json({ ok: true });
}
