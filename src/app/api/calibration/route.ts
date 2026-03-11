import { NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";

export async function GET() {
  const data = await dbGet<Record<string, [number, number]>>("calibration", {});
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  await dbSet("calibration", body);
  return NextResponse.json({ ok: true });
}
