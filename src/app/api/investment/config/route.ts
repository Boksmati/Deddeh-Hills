import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";
import {
  type InvestmentConfig,
  DEFAULT_INVESTMENT_CONFIG,
} from "@/lib/investment-layers";

const REDIS_KEY = "investment:threeParty:config";

function getRole(req: NextRequest): string | undefined {
  return req.cookies.get("dh_role")?.value;
}

function isAuthorized(req: NextRequest): boolean {
  const role = getRole(req);
  return role === "admin" || role === "investor";
}

function isAdmin(req: NextRequest): boolean {
  return getRole(req) === "admin";
}

/** GET — returns stored InvestmentConfig or defaults. Requires admin or investor role. */
export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const config = await dbGet<InvestmentConfig>(REDIS_KEY, DEFAULT_INVESTMENT_CONFIG);
  return NextResponse.json(config);
}

/** POST — updates InvestmentConfig. Admin only. */
export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  // Merge with defaults so missing fields fall back gracefully
  const config: InvestmentConfig = { ...DEFAULT_INVESTMENT_CONFIG, ...(body as Partial<InvestmentConfig>) };
  await dbSet(REDIS_KEY, config);
  return NextResponse.json(config);
}
