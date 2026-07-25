"use client";

import { useState } from "react";

export default function ClipsManager({ initialClips, initialCopy = {} }) {
  const [clips, setClips] = useState(initialClips);
  const [copySettings, setCopySettings] = useState(initialCopy || {});
  const [featuredClipId, setFeaturedClipId] = useState(initialCopy?.featuredClipId || null);
  const [bulkText, setBulkText] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [status, setStatus] = useState("");
  const [single, setSingle] = useState({ title: "", video_url: "", thumbnail_url: "", source_credit: "" });
  const [selectedFile, setSelectedFile] = useState(null);
  const [search, setSearch] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [uploadingFile, setUploadingFile] = useState(false);
  const [cdnBaseUrl, setCdnBaseUrl] = useState("");
  const [batchFiles, setBatchFiles] = useState([]);
  const [batchProgress, setBatchProgress] = useState({ done: 0, total: 0, failed: [] });
  const [batchRunning, setBatchRunning] = useState(false);

  const filteredClips = search
    ? clips.filter((c) =>
        [c.title, c.source_credit].join(" ").toLowerCase().includes(search.toLowerCase())
      )
    : clips;

  async function submitBulk(e) {
    e.preventDefault();
    setStatus("Uploading...");
    const res = await fetch("/api/admin/clips/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv: bulkText, note: bulkNote }),
    });
    const data = await res.json();
    if (res.ok) {
      setClips((c) => [...data.inserted, ...c]);
      setStatus(`Added ${data.inserted.length} clips.`);
      setBulkText("");
      setBulkNote("");
    } else {
      setStatus(`Error: ${data.error}`);
    }
  }

  async function submitSingle(e) {
    e.preventDefault();
    if (!selectedFile) {
      setStatus("Please choose a video file first.");
      return;
    }

    if (uploadingFile) {
      setStatus("Please wait for the file upload to finish.");
      return;
    }

    setUploadingFile(true);
    setStatus("Creating clip...");
    setUploadStatus("Uploading video...");

    try {
      console.log("Single-clip upload: starting video upload", {
        fileName: selectedFile.name,
        fileType: selectedFile.type,
        fileSize: selectedFile.size,
      });
      const videoUrl = await uploadToPresignedR2(selectedFile, selectedFile.name, selectedFile.type || "video/mp4");
      console.log("Single-clip upload: video upload complete", { videoUrl });
      setSingle((s) => ({ ...s, video_url: videoUrl }));
      setUploadStatus("Video uploaded — grabbing a thumbnail frame...");

      let thumbnailUrl = null;
      try {
        console.log("Single-clip upload: starting thumbnail capture");
        setUploadStatus("Uploading thumbnail...");
        const blob = await captureThumbnail(selectedFile);
        console.log("Single-clip upload: thumbnail capture complete", { size: blob.size, type: blob.type });
        const thumbFile = new File([blob], `thumb-${Date.now()}.jpg`, { type: "image/jpeg" });
        thumbnailUrl = await uploadToPresignedR2(thumbFile, thumbFile.name, thumbFile.type);
        console.log("Single-clip upload: thumbnail upload complete", { thumbnailUrl });
        setSingle((s) => ({ ...s, thumbnail_url: thumbnailUrl }));
      } catch (error) {
        console.error("Single-clip upload: thumbnail capture/upload failed", error);
        setUploadStatus("Video uploaded — thumbnail failed, you can add one manually below.");
      }

      const payload = {
        ...single,
        title: single.title.trim() || "Untitled clip",
        video_url: videoUrl,
        thumbnail_url: thumbnailUrl || null,
        source_credit: single.source_credit || "Unknown — help us ID this",
      };

      console.log("Single-clip upload: creating clip record", payload);
      const res = await fetch("/api/admin/clips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (parseError) {
        console.error("Single-clip upload: failed to parse clip-create response", parseError);
      }

      console.log("Single-clip upload: clip-create response", { ok: res.ok, status: res.status, data });

      if (res.ok) {
        setClips((c) => [data.clip, ...c]);
        setSingle({ title: "", video_url: "", thumbnail_url: "", source_credit: "" });
        setSelectedFile(null);
        setUploadStatus("Clip created successfully.");
        setStatus("");
      } else {
        const message = data.error || "Could not create clip";
        console.error("Single-clip upload: clip create failed", message);
        setUploadStatus(`Upload failed: ${message}`);
        setStatus(`Error: ${message}`);
      }
    } catch (error) {
      console.error("Single-clip upload: submission failed", error);
      setUploadStatus(`Upload failed: ${error.message || "Something went wrong"}`);
      setStatus(`Error: ${error.message || "Something went wrong"}`);
    } finally {
      setUploadingFile(false);
    }
  }

  function captureThumbnail(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      const objectUrl = URL.createObjectURL(file);
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;

      const cleanup = () => {
        URL.revokeObjectURL(objectUrl);
      };

      const onLoadedMetadata = () => {
        try {
          const seekTime = Math.min(1, (video.duration || 2) / 2);
          video.currentTime = Number.isFinite(seekTime) ? seekTime : 0;
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      const onSeeked = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 360;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              cleanup();
              blob ? resolve(blob) : reject(new Error("Could not capture frame"));
            },
            "image/jpeg",
            0.82
          );
        } catch (err) {
          cleanup();
          reject(err);
        }
      };

      const onError = () => {
        cleanup();
        reject(new Error("Video failed to load"));
      };

      video.addEventListener("loadedmetadata", onLoadedMetadata, { once: true });
      video.addEventListener("seeked", onSeeked, { once: true });
      video.addEventListener("error", onError, { once: true });
      video.src = objectUrl;
    });
  }

  async function uploadToPresignedR2(file, filename, contentType) {
    console.log("Presigned upload: requesting URL", { filename, contentType, size: file.size });

    let presignRes;
    try {
      presignRes = await fetch("/api/admin/clips/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, contentType }),
      });
    } catch (error) {
      console.error("Presigned upload: presign request threw", error);
      throw new Error(`Presign request failed: ${error.message || "Network error"}`);
    }

    let presignData = {};
    try {
      presignData = await presignRes.json();
    } catch (parseError) {
      console.error("Presigned upload: failed to parse presign response", parseError);
      throw new Error("Presign response was not valid JSON");
    }

    console.log("Presigned upload: presign response", { ok: presignRes.ok, status: presignRes.status, presignData });

    if (!presignRes.ok) {
      const message = presignData.error || "Could not prepare upload";
      console.error("Presigned upload: presign failed", message);
      throw new Error(message);
    }

    console.log("Presigned upload: starting PUT to R2", { uploadUrl: presignData.uploadUrl });

    let uploadRes;
    try {
      uploadRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: file,
      });
    } catch (error) {
      console.error("Presigned upload: PUT request threw", error);
      throw new Error(`R2 upload request failed: ${error.message || "Network error"}`);
    }

    console.log("Presigned upload: PUT response", { ok: uploadRes.ok, status: uploadRes.status });

    if (!uploadRes.ok) {
      const message = `R2 upload failed with status ${uploadRes.status}`;
      console.error("Presigned upload: PUT failed", message);
      throw new Error(message);
    }

    console.log("Presigned upload: PUT completed successfully", { publicUrl: presignData.publicUrl });
    return presignData.publicUrl;
  }

  async function prepareSelectedFile(file) {
    console.log("Single-clip upload: file selected", { fileName: file.name, fileType: file.type, fileSize: file.size });
    setSelectedFile(file);
    setUploadStatus("File selected — ready to add clip.");
    setStatus("");
    setUploadingFile(false);
  }

  async function runBatch() {
    if (!cdnBaseUrl.trim() || batchFiles.length === 0) return;
    setBatchRunning(true);
    const base = cdnBaseUrl.trim().replace(/\/+$/, "");
    const failed = [];
    let done = 0;
    setBatchProgress({ done: 0, total: batchFiles.length, failed: [] });

    const newClips = [];

    for (const file of batchFiles) {
      const title = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim();
      const video_url = `${base}/${encodeURIComponent(file.name)}`;
      let thumbnail_url = null;

      try {
        const blob = await captureThumbnail(file);
        const thumbFile = new File([blob], `thumb-${Date.now()}-${file.name}.jpg`, { type: "image/jpeg" });
        thumbnail_url = await uploadToPresignedR2(thumbFile, thumbFile.name, thumbFile.type);
      } catch {
        // no thumbnail — clip still gets created, just shows as a text tile for now
      }

      try {
        const res = await fetch("/api/admin/clips", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: title || "Untitled clip", video_url, thumbnail_url }),
        });
        const data = await res.json();
        if (res.ok) newClips.push(data.clip);
        else failed.push(`${file.name}: ${data.error}`);
      } catch (err) {
        failed.push(`${file.name}: ${err.message}`);
      }

      done++;
      setBatchProgress({ done, total: batchFiles.length, failed });
    }

    setClips((c) => [...newClips, ...c]);
    setBatchRunning(false);
  }

  async function saveField(clip, field, value) {
    const res = await fetch("/api/admin/clips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: clip.id, [field]: value || null }),
    });
    if (res.ok) {
      setClips((cs) => cs.map((c) => (c.id === clip.id ? { ...c, [field]: value } : c)));
    } else {
      const data = await res.json().catch(() => ({}));
      console.error("Failed to save clip field", field, data.error || res.statusText);
      alert(`Save failed — try again (${data.error || res.statusText})`);
    }
  }

  async function saveCredit(clip, value) {
    const res = await fetch("/api/admin/clips/credit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: clip.id, source_credit: value }),
    });
    if (res.ok) {
      setClips((cs) =>
        cs.map((c) => (c.id === clip.id ? { ...c, source_credit: value || "Unknown — help us ID this" } : c))
      );
    } else {
      const data = await res.json().catch(() => ({}));
      console.error("Failed to save clip credit", data.error || res.statusText);
      alert(`Save failed — try again (${data.error || res.statusText})`);
    }
  }

  async function toggleHide(clip) {
    const res = await fetch("/api/admin/clips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: clip.id, hidden: !clip.hidden }),
    });
    if (res.ok) {
      setClips((cs) => cs.map((c) => (c.id === clip.id ? { ...c, hidden: !c.hidden } : c)));
    }
  }

  async function deleteClip(clip) {
    if (!confirm(`Delete "${clip.title}"? This removes its votes too.`)) return;
    const res = await fetch(`/api/admin/clips?id=${clip.id}`, { method: "DELETE" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStatus(`Error: ${data.error || "Could not delete clip"}`);
      return;
    }

    setClips((cs) => cs.filter((c) => c.id !== clip.id));
    if (data.r2Deleted) {
      setStatus("Clip and files deleted.");
    } else {
      setStatus("Clip removed, but file cleanup on storage may have failed — check manually.");
    }
  }

  async function featureClip(clip) {
    const nextCopy = { ...copySettings, featuredClipId: clip.id };
    const res = await fetch("/api/admin/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copy: nextCopy }),
    });
    if (res.ok) {
      setCopySettings(nextCopy);
      setFeaturedClipId(clip.id);
      setStatus(`Featured clip updated.`);
    } else {
      const data = await res.json().catch(() => ({}));
      setStatus(`Error: ${data.error || "Could not update featured clip"}`);
    }
  }

  return (
    <div className="space-y-10">
      <section className="border border-chalk/30 rounded-md p-4">
        <h2 className="font-mono text-xs uppercase tracking-wide opacity-90 mb-2">Add one clip</h2>
        <form onSubmit={submitSingle} className="grid grid-cols-2 gap-2">
          <input
            value={single.title}
            onChange={(e) => setSingle({ ...single, title: e.target.value })}
            placeholder="Title (optional)"
            className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk col-span-2"
          />
          <label className="col-span-2 flex items-center gap-2 border border-line rounded-md px-3 py-2 text-sm cursor-pointer hover:border-chalk">
            <span className="font-mono text-xs opacity-70">Upload video file</span>
            <input
              type="file"
              accept="video/mp4,video/*"
              onChange={(e) => {
                const file = e.target.files[0];
                if (!file) return;
                const guess = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]+/g, " ").trim();
                setSingle((s) => ({ ...s, title: s.title || guess }));
                prepareSelectedFile(file);
              }}
              className="text-xs"
            />
          </label>
          {uploadStatus && <p className="col-span-2 text-xs font-mono opacity-70">{uploadStatus}</p>}
          <input
            value={single.source_credit}
            onChange={(e) => setSingle({ ...single, source_credit: e.target.value })}
            placeholder="Source credit (optional)"
            className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk col-span-2"
          />
          <button
            type="submit"
            disabled={uploadingFile || !selectedFile}
            className="self-start border border-line rounded-md px-4 py-2 text-sm font-mono hover:border-chalk disabled:opacity-40 col-span-2"
          >
            {uploadingFile ? "Uploading..." : "Add clip"}
          </button>
        </form>
      </section>

      <details className="border border-chalk/30 rounded-md p-4">
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-wide opacity-90">
          Bulk / advanced options
        </summary>
        <div className="mt-4 space-y-8">
          <section>
            <h2 className="font-mono text-xs uppercase tracking-wide opacity-90 mb-1">
              Bulk upload from your R2 folder (this is the one for all 500)
            </h2>
            <p className="text-xs opacity-60 mb-3">
              First upload all your video files to your R2 bucket (via Cloudflare's dashboard or CLI — this
              site doesn't do that part). Then come back here, select those same files from your computer, enter
              your R2 public base URL, and this generates a thumbnail for every clip and creates all the entries
              automatically — no per-clip clicking.
            </p>
            <input
              value={cdnBaseUrl}
              onChange={(e) => setCdnBaseUrl(e.target.value)}
              placeholder="R2 base URL, e.g. https://cdn.oldmantriesbjj.com"
              className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk w-full mb-2"
            />
            <input
              type="file"
              accept="video/mp4,video/*"
              multiple
              onChange={(e) => setBatchFiles(Array.from(e.target.files))}
              className="text-xs mb-2"
            />
            {batchFiles.length > 0 && (
              <p className="text-xs font-mono opacity-70 mb-2">{batchFiles.length} files selected</p>
            )}
            <button
              onClick={runBatch}
              disabled={batchRunning || !cdnBaseUrl.trim() || batchFiles.length === 0}
              className="border border-line rounded-md px-4 py-2 text-sm font-mono hover:border-chalk disabled:opacity-40"
            >
              {batchRunning ? "Processing..." : "Start bulk upload"}
            </button>
            {batchProgress.total > 0 && (
              <p className="text-xs font-mono opacity-70 mt-2">
                {batchProgress.done} / {batchProgress.total} processed
                {batchProgress.failed.length > 0 && ` — ${batchProgress.failed.length} failed`}
              </p>
            )}
            {batchProgress.failed.length > 0 && (
              <div className="mt-2 text-xs font-mono text-trash space-y-0.5">
                {batchProgress.failed.map((f, i) => (
                  <p key={i}>{f}</p>
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="font-mono text-xs uppercase tracking-wide opacity-60 mb-2">
              Bulk import (paste a list — for clips already hosted somewhere)
            </h2>
            <p className="text-xs opacity-60 mb-2">
              One clip per line: <code className="opacity-80">title, video_url, creator</code>.
              Video URL is the direct link to your hosted mp4 — leave it and creator blank if not ready, fill
              in later.
            </p>
            <form onSubmit={submitBulk} className="flex flex-col gap-2">
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                rows={8}
                placeholder={"Knee on belly escape, https://cdn.oldmantriesbjj.com/clips/001.mp4, John Danaher\nButterfly sweep from guard, , "}
                className="bg-transparent border border-line rounded-md px-3 py-2 text-sm font-mono outline-none focus:border-chalk"
              />
              <input
                value={bulkNote}
                onChange={(e) => setBulkNote(e.target.value)}
                placeholder="Optional note for the announcement banner (e.g. 'guard passing batch')"
                className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk"
              />
              <button className="self-start border border-line rounded-md px-4 py-2 text-sm font-mono hover:border-chalk">
                Import batch
              </button>
              {status && <p className="text-xs font-mono opacity-70">{status}</p>}
            </form>
          </section>
        </div>
      </details>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-wide opacity-60 mb-2">
          All clips ({filteredClips.length}{search ? ` of ${clips.length}` : ""})
        </h2>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title or creator"
          className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk mb-2 w-full"
        />
        <div className="space-y-1 max-h-[600px] overflow-y-auto">
          {filteredClips.map((clip) => {
            const isFeatured = featuredClipId === clip.id;
            return (
              <div
                key={clip.id}
                className={`flex items-center gap-2 border border-line rounded-md px-3 py-2 text-sm ${
                  clip.hidden ? "opacity-40" : ""
                } ${isFeatured ? "bg-legit/10 font-semibold" : ""}`}
              >
                <span className="flex-1 truncate">{clip.title}</span>
                <EditableField clip={clip} field="video_url" placeholder="video url" onSave={saveField} />
                <EditableField clip={clip} field="thumbnail_url" placeholder="thumb url" onSave={saveField} />
                <CreditInput clip={clip} onSave={saveCredit} />
                <button
                  type="button"
                  onClick={() => featureClip(clip)}
                  className={`font-mono text-xs ${isFeatured ? "text-legit" : "opacity-70 hover:opacity-100"}`}
                >
                  {isFeatured ? "featured" : "feature"}
                </button>
                <button
                  type="button"
                  onClick={() => toggleHide(clip)}
                  className="font-mono text-xs opacity-70 hover:opacity-100"
                >
                  {clip.hidden ? "unhide" : "hide"}
                </button>
                <button
                  type="button"
                  onClick={() => deleteClip(clip)}
                  className="font-mono text-xs text-trash opacity-80 hover:opacity-100"
                >
                  delete
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function EditableField({ clip, field, placeholder, onSave }) {
  const [value, setValue] = useState(clip[field] || "");

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onSave(clip, field, value)}
      placeholder={placeholder}
      className="bg-transparent border border-line rounded-md px-2 py-1 text-xs font-mono outline-none focus:border-chalk w-28"
    />
  );
}

function CreditInput({ clip, onSave }) {
  const [value, setValue] = useState(
    clip.source_credit === "Unknown — help us ID this" ? "" : clip.source_credit
  );

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => onSave(clip, value)}
      placeholder="tag creator"
      className="bg-transparent border border-line rounded-md px-2 py-1 text-xs font-mono outline-none focus:border-chalk w-32"
    />
  );
}
