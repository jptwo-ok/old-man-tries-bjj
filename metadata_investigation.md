# Clip video embedded-metadata investigation

Investigation only — no clips, files, or database rows were modified.

## Method

Used a portable `ffprobe` (via `@ffprobe-installer/ffprobe`, the same setup from the duration-analysis task) to run a full metadata dump against a 16-clip sample:

```
ffprobe -v error -show_format -show_streams -print_format json "VIDEO_URL"
```

Queried Supabase directly (read-only) for the sample selection. Two things surfaced before probing even started, worth noting up front because they shaped the sample and the conclusion:

- **535 non-deleted clips total** (matches the "535 non-deleted clips" figure in the task — 0 hidden).
- **`added_at` timestamps show the library is essentially one bulk import, not many batches.** 533 of 535 clips were all inserted within a single ~4-minute window on 2026-07-17. Only two clips fall outside that window: one added 2026-07-15 (the lone Supabase-Storage-hosted clip) and one added 2026-07-25 ("Six Leg Lock Positions"). So "spanning different upload dates/batches" mostly means "the one mass import" plus these two individually-added outliers — there aren't really multiple distinct historical batches to compare.

Sample (16 clips): the 8 earliest and 8 latest rows by `added_at`, which — given the above — captures both timestamp outliers plus a spread across the single bulk batch by insertion order.

## Finding, stated plainly

**Almost nothing — with one real exception.**

14 of the 16 sampled clips (all from the 2026-07-17 bulk-import batch, plus the 2026-07-15 Supabase-hosted one) have **only bare technical container tags**: `major_brand`, `minor_version`, `compatible_brands` at the format level, and `language`/`handler_name`/`vendor_id` (all boilerplate placeholder values — `language: und`, `vendor_id: [0][0][0][0]`) at the stream level. Some also carry `encoder: "AVC Coding"` on the video stream — a generic string produced by countless Android camera/recording apps and re-encoders, not something that identifies a specific source. No `creation_time`, `artist`, `location`/GPS, `copyright`, `description`, `make`/`model`, or `software` field appeared on **any** sampled clip — I grepped the raw JSON for all of these explicitly, not just eyeballed the tags I happened to print.

**One clip is different: "Six Leg Lock Positions"** (`726e0da7-3725-48d8-b559-03af04ed25bc`, the 2026-07-25 outlier — the *only* clip added outside the mass import). Its `format.tags` includes:

```json
{
  "major_brand": "isom",
  "minor_version": "512",
  "compatible_brands": "isomiso2avc1mp41",
  "comment": "vid:v12044gd0000cfv5u9rc77u1ikgugscg",
  "encoder": "Lavf58.76.100"
}
```

Two real signals here:
- `comment: "vid:v12044gd0000cfv5u9rc77u1ikgugscg"` — the `v12044gd0000...` shape is TikTok's internal video-ID format. This looks like a residual ID left behind by whatever tool downloaded/re-encoded this clip from TikTok.
- `encoder: "Lavf58.76.100"` — this is FFmpeg's own libavformat muxer signature, meaning this specific file was re-muxed through ffmpeg by some downstream tool (consistent with a TikTok-downloader that strips the watermark via an ffmpeg re-encode and leaves this tag behind) — a distinctly different processing history from the `AVC Coding` phone-encoder signature on every bulk-batch clip.

Separately, not embedded video metadata but worth flagging since it's the same underlying question ("hint at original source"): the one Supabase-hosted clip's Supabase **title field itself** reads `"3 tips dont let them pass easily againnn jiujits C6ohOj9uFeA"` — `C6ohOj9uFeA` is an 11-character string in exactly YouTube's video-ID format, strongly suggesting this title is an unedited copy-paste of an original YouTube video title + ID. That's a `clips.title` observation, not something ffprobe found, but it's a genuine, easy attribution lead sitting in plain text in the database already.

## What distinguishes the one clip with real metadata from the rest

It's not the storage backend (R2 vs. Supabase Storage) — the Supabase-hosted clip has just as little as the R2 ones. It's **how the clip was added**: the single outlier added individually, after and separate from the 533-clip bulk import, is the one with a TikTok-shaped `comment` tag and an ffmpeg re-mux `encoder` signature. Every clip that went through the mass bulk-import batch — which is the vast majority of the library — carries only generic phone-camera-style container tags with nothing source-identifying.

## Is it worth checking all 541 (541 total, 535 non-deleted)?

Worth doing, but calibrate expectations by this pattern:

- The 533 bulk-imported clips are very likely uniform — they share the same import path and the sampled ones show identical, bare tag structure. A full check of that group specifically probably comes back close to empty, but "probably" isn't "confirmed," and a full run is cheap (the duration-analysis task probed all 541 clips in 24 seconds), so there's no real cost to just running it rather than assuming.
- Clips added individually/outside that bulk batch are the more promising target — this sample only had two such clips, and one of them already had something. If there are more individually-added clips elsewhere in the 535 (this needs a full `added_at` pass to know for sure — this investigation only sampled 16), those are worth checking with actual expectation of finding something, not just for completeness.

## Raw ffprobe output — representative examples

### Most metadata found: "Six Leg Lock Positions" (`726e0da7-3725-48d8-b559-03af04ed25bc`)

```json
{
  "streams": [
    {
      "index": 0,
      "codec_name": "h264",
      "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
      "profile": "High",
      "codec_type": "video",
      "codec_tag_string": "avc1",
      "codec_tag": "0x31637661",
      "width": 720,
      "height": 1280,
      "coded_width": 720,
      "coded_height": 1280,
      "sample_aspect_ratio": "1:1",
      "display_aspect_ratio": "9:16",
      "pix_fmt": "yuv420p",
      "level": 31,
      "color_range": "tv",
      "color_space": "bt709",
      "color_transfer": "bt709",
      "color_primaries": "bt709",
      "field_order": "progressive",
      "r_frame_rate": "30/1",
      "avg_frame_rate": "30/1",
      "duration": "82.233333",
      "bit_rate": "723641",
      "nb_frames": "2467",
      "tags": {
        "language": "und",
        "handler_name": "VideoHandler",
        "vendor_id": "[0][0][0][0]"
      }
    },
    {
      "index": 1,
      "codec_name": "aac",
      "codec_type": "audio",
      "profile": "HE-AACv2",
      "sample_rate": "44100",
      "channels": 2,
      "channel_layout": "stereo",
      "duration": "82.242993",
      "bit_rate": "64145",
      "nb_frames": "1775",
      "tags": {
        "language": "und",
        "handler_name": "SoundHandler",
        "vendor_id": "[0][0][0][0]"
      }
    }
  ],
  "format": {
    "filename": "https://cdn.oldmantriesbjj.com/Six%20Leg%20Lock%20Positions.mp4",
    "nb_streams": 2,
    "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
    "format_long_name": "QuickTime / MOV",
    "duration": "82.242993",
    "size": "8166948",
    "bit_rate": "794421",
    "probe_score": 100,
    "tags": {
      "major_brand": "isom",
      "minor_version": "512",
      "compatible_brands": "isomiso2avc1mp41",
      "comment": "vid:v12044gd0000cfv5u9rc77u1ikgugscg",
      "encoder": "Lavf58.76.100"
    }
  }
}
```

### Least metadata (representative of the 533-clip bulk batch): "Leg lock 3" (`580c29ba-3dec-4d02-a963-14b0de32ce1c`)

```json
{
  "streams": [
    {
      "index": 0,
      "codec_name": "h264",
      "codec_long_name": "H.264 / AVC / MPEG-4 AVC / MPEG-4 part 10",
      "profile": "High",
      "codec_type": "video",
      "codec_tag_string": "avc1",
      "width": 720,
      "height": 1280,
      "display_aspect_ratio": "9:16",
      "pix_fmt": "yuv420p",
      "r_frame_rate": "30/1",
      "avg_frame_rate": "30/1",
      "duration": "24.466667",
      "bit_rate": "1070161",
      "nb_frames": "734",
      "tags": {
        "language": "und",
        "handler_name": "VideoHandler",
        "vendor_id": "[0][0][0][0]",
        "encoder": "AVC Coding"
      }
    },
    {
      "index": 1,
      "codec_name": "aac",
      "codec_type": "audio",
      "profile": "HE-AAC",
      "sample_rate": "48000",
      "channels": 2,
      "channel_layout": "stereo",
      "duration": "24.574708",
      "bit_rate": "75846",
      "nb_frames": "576",
      "tags": {
        "language": "und",
        "handler_name": "SoundHandler",
        "vendor_id": "[0][0][0][0]"
      }
    }
  ],
  "format": {
    "filename": "https://cdn.oldmantriesbjj.com/Leg%20lock%203.mp4",
    "nb_streams": 2,
    "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
    "format_long_name": "QuickTime / MOV",
    "duration": "24.574708",
    "size": "3526663",
    "bit_rate": "1148062",
    "probe_score": 100,
    "tags": {
      "major_brand": "isom",
      "minor_version": "512",
      "compatible_brands": "isomiso2avc1mp41"
    }
  }
}
```

### Cross-check — the one Supabase-Storage-hosted clip (not R2/CDN): (`b6fd589f-ae07-4066-b7bb-fa1695d62525`)

Included to confirm the pattern isn't about which storage backend serves the file — this one is hosted on `supabase.co`, not R2, and shows the same bare pattern as the R2-hosted bulk clips:

```json
{
  "format": {
    "filename": "https://zkjpudjvmeqriwmsqnna.supabase.co/storage/v1/object/public/clips/1784152776424-3-back-chokes.mp4",
    "format_name": "mov,mp4,m4a,3gp,3g2,mj2",
    "duration": "98.472971",
    "size": "9926041",
    "bit_rate": "806443",
    "probe_score": 100,
    "tags": {
      "major_brand": "isom",
      "minor_version": "512",
      "compatible_brands": "isomiso2avc1mp41"
    }
  },
  "streams_tags_summary": {
    "video_stream": { "language": "und", "handler_name": "VideoHandler", "vendor_id": "[0][0][0][0]", "encoder": "AVC Coding" },
    "audio_stream": { "language": "und", "handler_name": "SoundHandler", "vendor_id": "[0][0][0][0]" }
  }
}
```

(Video/audio stream tags summarized here rather than pasted in full, since they're identical in shape to the "Leg lock 3" example above — same bare `language`/`handler_name`/`vendor_id`/`encoder` set, no additional fields.)

## Sample details

16 clips probed, all succeeded (0 failures). Full per-clip results (id, title, `added_at`, and complete tag dumps) are in the session's scratch output and not included verbatim here beyond the three examples above, to keep this file focused — the summary above reflects all 16, not just the three shown.
