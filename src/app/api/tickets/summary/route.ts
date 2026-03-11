import { NextRequest, NextResponse } from "next/server";
import { dbGet } from "@/lib/kv";

function isAuthorized(req: NextRequest): boolean {
  const role = req.cookies.get("dh_role")?.value;
  return role === "admin" || role === "investor";
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [layer1Total, layer2Total] = await Promise.all([
    dbGet<number>("tickets:layer1:total", 0),
    dbGet<number>("tickets:layer2:total", 0),
  ]);

  return NextResponse.json({
    layer1: { totalRaised: layer1Total },
    layer2: { totalVillas: layer2Total },
  });
}
