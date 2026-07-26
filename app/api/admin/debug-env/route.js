import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

// TEMPORARY diagnostic-only route. Do not expose full URLs or keys.
// Safe to delete once the production/env mismatch investigation is done.
export async function GET() {
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const maskedUrl = url ? `...${url.slice(-8)}` : null;

  const supabase = supabaseAdmin();
  const { count, error } = await supabase
    .from("clips")
    .select("id", { count: "exact", head: true })
    .neq("category", "Uncategorized");

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({
    supabaseUrlSuffix: maskedUrl,
    categorizedClipCount: count,
  });
}
