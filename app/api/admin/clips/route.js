import { NextResponse } from "next/server";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { isAdmin } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

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
  const allowedFields = ["title", "video_url", "thumbnail_url", "source_credit", "hidden"];
  const invalidFields = Object.keys(updates).filter((key) => !allowedFields.includes(key));

  if (invalidFields.length > 0) {
    return NextResponse.json(
      { error: `Invalid field(s): ${invalidFields.join(", ")}` },
      { status: 400 }
    );
  }

  const { error } = await supabase.from("clips").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  if (!isAdmin()) return unauthorized();
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const supabase = supabaseAdmin();

  const { data: clip, error: fetchError } = await supabase
    .from("clips")
    .select("video_url, thumbnail_url")
    .eq("id", id)
    .single();

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 400 });

  let r2Deleted = true;
  const objectKeys = [];
  for (const url of [clip?.video_url, clip?.thumbnail_url]) {
    if (!url) continue;
    const prefix = "https://cdn.oldmantriesbjj.com/";
    if (!url.startsWith(prefix)) continue;
    const key = decodeURIComponent(url.slice(prefix.length));
    if (key) objectKeys.push(key);
  }

  for (const key of objectKeys) {
    try {
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
        })
      );
    } catch (error) {
      console.error("Failed to delete R2 object", { key, error: error.message });
      r2Deleted = false;
    }
  }

  const { error } = await supabase.from("clips").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, r2Deleted });
}
