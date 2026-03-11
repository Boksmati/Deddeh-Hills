import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";
import { DEFAULT_LAYER_PARAMS, type LayerConfig } from "@/lib/investment-layers";

const KEY = "investment:layers:config";

function isAuthorized(req: NextRequest): boolean {
  const role = req.cookies.get("dh_role")?.value;
  return role === "admin" || role === "investor";
}

function isAdmin(req: NextRequest): boolean {
  return req.cookies.get("dh_role")?.value === "admin";
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const config = await dbGet<LayerConfig>(KEY, DEFAULT_LAYER_PARAMS);
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  if (!isAdmin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const current = await dbGet<LayerConfig>(KEY, DEFAULT_LAYER_PARAMS);
  const updated: LayerConfig = {
    ...current,
    ...body,
    _updated: new Date().toISOString(),
  };
  await dbSet(KEY, updated);
  return NextResponse.json(updated);
}
