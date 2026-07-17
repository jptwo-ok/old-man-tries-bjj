import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

function parseLine(line) {
  const parts = line.split(",").map((p) => p.trim());
  const [title, video_url, source_credit] = parts;
  if (!title) return null;
  return {
    title,
    video_url: video_url || null,
    source_credit: source_credit || "Unknown — help us ID this",
  };
}

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { csv, note } = await req.json();
  const lines = (csv || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const rows = lines.map(parseLine).filter(Boolean);

  if (rows.length === 0) {
    return NextResponse.json({ error: "No valid rows found" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: inserted, error } = await supabase.from("clips").insert(rows).select();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  await supabase.from("upload_batches").insert({
    clip_count: inserted.length,
    note: note || null,
  });

  return NextResponse.json({ inserted });
}
