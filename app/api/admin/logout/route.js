import { NextResponse } from "next/server";
import { clearAdminCookie } from "@/lib/adminAuth";

export async function POST() {
  clearAdminCookie();
  return NextResponse.redirect(new URL("/admin/login", process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"));
}
