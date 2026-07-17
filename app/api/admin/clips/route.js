import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function POST(req) {
  if (!isAdmin()) return unauthorized();
  const body = await req.json();
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("clips")
    .insert({
      title: body.title,
      video_url: body.video_url || null,
      thumbnail_url: body.thumbnail_url || null,
      source_credit: body.source_credit || "Unknown — help us ID this",
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ clip: data });
}

export async function PATCH(req) {
  if (!isAdmin()) return unauthorized();
  const body = await req.json();
  const supabase = supabaseAdmin();

  const { id, ...updates } = body;
  const { error } = await supabase.from("clips").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  if (!isAdmin()) return unauthorized();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const supabase = supabaseAdmin();

  const { error } = await supabase.from("clips").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
