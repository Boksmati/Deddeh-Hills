import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set("dh_access", "", { maxAge: 0, path: "/" });
  res.cookies.set("dh_role", "", { maxAge: 0, path: "/" });
  return res;
}
