import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";

export async function GET() {
  const data = await dbGet<Record<string, unknown> | null>("model-inputs", null);
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  await dbSet("model-inputs", body);
  return NextResponse.json({ ok: true });
}
