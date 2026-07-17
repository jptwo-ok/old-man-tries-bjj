import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { theme, copy } = await req.json();
  const supabase = supabaseAdmin();

  const updates = [];
  if (theme) updates.push(supabase.from("site_settings").update({ value: theme, updated_at: new Date().toISOString() }).eq("key", "theme"));
  if (copy) updates.push(supabase.from("site_settings").update({ value: copy, updated_at: new Date().toISOString() }).eq("key", "site_copy"));

  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed) return NextResponse.json({ error: failed.error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
