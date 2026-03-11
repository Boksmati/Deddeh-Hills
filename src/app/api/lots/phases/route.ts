import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";

const KV_KEY = "lots:phases";

/** Phase assignment map: { [lotNumber]: 1 | 2 | 3 } */
export type LotPhaseMap = Record<number, 1 | 2 | 3>;

function isAdmin(req: NextRequest): boolean {
  const jar = req.cookies;
  const role = jar.get("dh_role")?.value;
  return role === "admin";
}

export async function GET(req: NextRequest) {
  // Investors and admins can read phase assignments
  const role = req.cookies.get("dh_role")?.value;
  if (!role || (role !== "admin" && role !== "investor")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const data = await dbGet<LotPhaseMap>(KV_KEY, {} as LotPhaseMap);
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  try {
    const body = await req.json();
    // body should be { [lotNumber]: 1|2|3 } — validate types
    const validated: LotPhaseMap = {};
    for (const [k, v] of Object.entries(body)) {
      const lotNum = parseInt(k, 10);
      const phase = Number(v) as 1 | 2 | 3;
      if (!isNaN(lotNum) && [1, 2, 3].includes(phase)) {
        validated[lotNum] = phase;
      }
    }
    await dbSet(KV_KEY, validated);
    return NextResponse.json({ ok: true, count: Object.keys(validated).length });
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
}
