import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const DATA_FILE = join(process.cwd(), "data", "calibration.json");

function readFile(): Record<string, [number, number]> {
  try {
    return JSON.parse(readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function writeFile(data: Record<string, [number, number]>) {
  try {
    mkdirSync(join(process.cwd(), "data"), { recursive: true });
    writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error("Failed to write calibration file:", e);
  }
}

export async function GET() {
  return NextResponse.json(readFile());
}

export async function POST(req: Request) {
  const body = await req.json();
  writeFile(body);
  return NextResponse.json({ ok: true });
}
