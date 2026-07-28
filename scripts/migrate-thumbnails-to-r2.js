// Migrates Supabase-hosted clip thumbnails to Cloudflare R2 to eliminate
// Supabase Storage egress. Only touches thumbnail_url — video_url and every
// other clip field are left untouched. Old Supabase files are left in place
// (not deleted) — storage isn't the cost problem, egress traffic is.
//
// Usage:
//   node scripts/migrate-thumbnails-to-r2.js --limit=5   (test batch)
//   node scripts/migrate-thumbnails-to-r2.js             (full run — picks up
//                                                          whatever still
//                                                          matches, so it's
//                                                          safe to re-run)
//
// NOTE: lib/r2Client.js uses ESM `export` syntax, which this CommonJS script
// (run directly via `node`, no Next.js build step) cannot `require()`. The
// S3Client below is reconstructed with the identical config, matching the
// pattern already used by scripts/test-r2-auth.js.

const fs = require("fs");
const path = require("path");
const https = require("https");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { createClient } = require("@supabase/supabase-js");

function loadEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    process.env[key] = value;
  }
}
loadEnvLocal();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const R2_PUBLIC_BASE = "https://cdn.oldmantriesbjj.com";
const CONCURRENCY = 10;
const PROGRESS_EVERY = 25;

function parseLimitArg() {
  const arg = process.argv.find((a) => a.startsWith("--limit="));
  if (!arg) return null;
  const n = parseInt(arg.split("=")[1], 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function fetchSupabaseThumbnailClips() {
  let allRows = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from("clips")
      .select("id, title, thumbnail_url")
      .ilike("thumbnail_url", "%supabase.co%")
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw new Error("fetch clips: " + error.message);
    if (!data || data.length === 0) break;
    allRows = allRows.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return allRows;
}

async function countSupabaseThumbnailClips() {
  const { count, error } = await supabase
    .from("clips")
    .select("id", { count: "exact", head: true })
    .ilike("thumbnail_url", "%supabase.co%");
  if (error) throw new Error("count clips: " + error.message);
  return count;
}

function headRequest(url) {
  return new Promise((resolve) => {
    try {
      const u = new URL(url);
      const req = https.request(
        { method: "HEAD", hostname: u.hostname, path: u.pathname + u.search, timeout: 15000 },
        (res) => {
          resolve({
            ok: res.statusCode === 200,
            status: res.statusCode,
            contentType: res.headers["content-type"] || null,
            contentLength: res.headers["content-length"] || null,
          });
          res.resume();
        }
      );
      req.on("timeout", () => {
        req.destroy();
        resolve({ ok: false, error: "timeout" });
      });
      req.on("error", (err) => resolve({ ok: false, error: err.message }));
      req.end();
    } catch (err) {
      resolve({ ok: false, error: err.message });
    }
  });
}

async function migrateOne(clip) {
  try {
    const res = await fetch(clip.thumbnail_url);
    if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
    const buffer = Buffer.from(await res.arrayBuffer());

    const key = `thumbs/${clip.id}.jpg`;
    await r2Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: "image/jpeg",
      })
    );

    const newUrl = `${R2_PUBLIC_BASE}/${key}`;
    const { error: updateError } = await supabase
      .from("clips")
      .update({ thumbnail_url: newUrl })
      .eq("id", clip.id);
    if (updateError) throw new Error("supabase update failed: " + updateError.message);

    return { id: clip.id, title: clip.title, status: "success", newUrl, bytes: buffer.length };
  } catch (err) {
    return { id: clip.id, title: clip.title, status: "failed", error: err.message };
  }
}

async function processWithConcurrency(clips, limit) {
  const results = new Array(clips.length);
  let idx = 0;
  let processed = 0;

  async function worker() {
    while (idx < clips.length) {
      const cur = idx++;
      results[cur] = await migrateOne(clips[cur]);
      processed++;
      if (processed % PROGRESS_EVERY === 0 || processed === clips.length) {
        const succeededSoFar = results.filter((r) => r && r.status === "success").length;
        const failedSoFar = results.filter((r) => r && r.status === "failed").length;
        console.log(
          `Progress: ${processed}/${clips.length} processed (succeeded ${succeededSoFar}, failed ${failedSoFar})`
        );
      }
    }
  }

  const workers = Array.from({ length: Math.min(limit, clips.length) }, worker);
  await Promise.all(workers);
  return results;
}

async function main() {
  const limitArg = parseLimitArg();
  const isTestRun = limitArg !== null;

  let clips = await fetchSupabaseThumbnailClips();
  console.log(`Found ${clips.length} clips currently with a Supabase-hosted thumbnail_url.`);

  if (isTestRun) {
    clips = clips.slice(0, limitArg);
    console.log(`TEST RUN — processing only the first ${clips.length} clip(s).\n`);
  } else {
    console.log(`FULL RUN — processing all ${clips.length} matching clip(s).\n`);
  }

  const results = await processWithConcurrency(clips, CONCURRENCY);

  const succeeded = results.filter((r) => r.status === "success");
  const failed = results.filter((r) => r.status === "failed");

  console.log("\n--- Per-clip results ---");
  for (const r of results) {
    if (r.status === "success") {
      console.log(`OK    id=${r.id} "${r.title}" -> ${r.newUrl} (${r.bytes} bytes)`);
    } else {
      console.log(`FAIL  id=${r.id} "${r.title}" -> ${r.error}`);
    }
  }

  if (isTestRun && succeeded.length > 0) {
    console.log("\n--- HEAD verification of new R2 URLs (test run only) ---");
    for (const r of succeeded) {
      const head = await headRequest(r.newUrl);
      console.log(
        `HEAD id=${r.id} -> ${head.ok ? "OK" : "FAIL"} status=${head.status ?? "n/a"} ` +
          `content-type=${head.contentType ?? "n/a"} content-length=${head.contentLength ?? "n/a"}` +
          (head.error ? ` error=${head.error}` : "")
      );
    }
  }

  const remainingSupabaseCount = await countSupabaseThumbnailClips();

  console.log("\n--- Summary ---");
  console.log(`Total processed: ${results.length}`);
  console.log(`Succeeded: ${succeeded.length}`);
  console.log(`Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log("Failed clips (id, title, error):");
    for (const f of failed) {
      console.log(`  - id=${f.id} title="${f.title}" error="${f.error}"`);
    }
  }
  console.log(`Clips still with a Supabase-hosted thumbnail_url (post-run count): ${remainingSupabaseCount}`);
}

main().catch((e) => {
  console.error("FATAL:", e.message, e.stack);
  process.exit(1);
});
