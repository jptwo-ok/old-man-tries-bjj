import { NextResponse } from "next/server";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { isAdmin } from "@/lib/adminAuth";

const publicBaseUrl = "https://cdn.oldmantriesbjj.com/";

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

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
    const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn: 60 });
    return NextResponse.json({
      uploadUrl,
      publicUrl: `${publicBaseUrl}${encodeURIComponent(key)}`,
      key,
    });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Could not create upload URL" }, { status: 500 });
  }
}
