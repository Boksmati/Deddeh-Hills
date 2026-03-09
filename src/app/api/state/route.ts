import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_DIR = join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "state.json");

function readState(): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeState(data: Record<string, unknown>) {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to write state file:", e);
  }
}

export async function GET() {
  return NextResponse.json(readState());
}

export async function POST(req: Request) {
  const body = await req.json();
  writeState(body);
  return NextResponse.json({ ok: true });
}
