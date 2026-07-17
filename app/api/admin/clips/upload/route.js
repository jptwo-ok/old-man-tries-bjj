import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const supabase = supabaseAdmin();
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "-");
  const path = `${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from("clips").upload(path, file, {
    contentType: file.type || "video/mp4",
    upsert: false,
  });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data } = supabase.storage.from("clips").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl });
}
