import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { count, note } = await req.json();
  const supabase = supabaseAdmin();

  const { error } = await supabase.from("upload_batches").insert({
    clip_count: count || 0,
    note: note || null,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
