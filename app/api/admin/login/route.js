import { NextResponse } from "next/server";
import { checkPassword, setAdminCookie } from "@/lib/adminAuth";

export async function POST(req) {
  const { password } = await req.json();
  if (!checkPassword(password)) {
    return NextResponse.json({ error: "Wrong password" }, { status: 401 });
  }
  setAdminCookie();
  return NextResponse.json({ ok: true });
}
