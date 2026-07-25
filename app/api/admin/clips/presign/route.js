import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isAdmin } from "@/lib/adminAuth";
import { r2Client } from "@/lib/r2Client";

const publicBaseUrl = "https://cdn.oldmantriesbjj.com/";

export async function POST(req) {
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { filename, contentType = "application/octet-stream" } = await req.json();
  if (!filename) return NextResponse.json({ error: "Filename is required" }, { status: 400 });

  const safeFilename = String(filename)
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const key = safeFilename || "upload";
  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  try {
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 600 });
    return NextResponse.json({
      uploadUrl,
      publicUrl: `${publicBaseUrl}${encodeURIComponent(key)}`,
      key,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not create upload URL" }, { status: 500 });
  }
}
