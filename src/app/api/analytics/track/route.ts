import { NextRequest, NextResponse } from "next/server";
import { dbGet, dbSet } from "@/lib/kv";

const MAX_EVENTS = 3000;
const KEY = "dh:analytics";

export interface StoredEvent {
  id: string;
  event: string;
  page: string;
  sessionId: string;
  data?: Record<string, unknown>;
  ts: number;
  ip: string;
  ua: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";
    const ua = req.headers.get("user-agent") ?? "";

    const ev: StoredEvent = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      event: String(body.event ?? "unknown"),
      page: String(body.page ?? "/"),
      sessionId: String(body.sessionId ?? "unknown"),
      data: typeof body.data === "object" && body.data !== null ? body.data : undefined,
      ts: typeof body.ts === "number" ? body.ts : Date.now(),
      ip,
      ua,
    };

    const events = await dbGet<StoredEvent[]>(KEY, []);
    events.push(ev);
    await dbSet(KEY, events.slice(-MAX_EVENTS));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
