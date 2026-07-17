import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, source_credit } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing clip id" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { error } = await supabase
    .from("clips")
    .update({ source_credit: source_credit || "Unknown — help us ID this" })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
