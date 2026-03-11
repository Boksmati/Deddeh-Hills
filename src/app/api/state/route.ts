import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";

export async function GET() {
  const data = await dbGet<Record<string, unknown>>("state", {});
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  await dbSet("state", body);
  return NextResponse.json({ ok: true });
}
