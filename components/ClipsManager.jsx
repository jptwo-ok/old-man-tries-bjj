"use client";

import { useState } from "react";

export default function ClipsManager({ initialClips }) {
  const [clips, setClips] = useState(initialClips);
  const [bulkText, setBulkText] = useState("");
  const [bulkNote, setBulkNote] = useState("");
  const [status, setStatus] = useState("");
  const [single, setSingle] = useState({ title: "", video_url: "", thumbnail_url: "", source_credit: "" });
  const [search, setSearch] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
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
    const res = await fetch("/api/admin/clips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...single, title: single.title.trim() || "Untitled clip" }),
    });
    const data = await res.json();
    if (res.ok) {
      setClips((c) => [data.clip, ...c]);
      setSingle({ title: "", video_url: "", thumbnail_url: "", source_credit: "" });
    }
  }

  function captureThumbnail(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      video.src = URL.createObjectURL(file);

      video.addEventListener("loadedmetadata", () => {
        video.currentTime = Math.min(1, (video.duration || 2) / 2);
      });
      video.addEventListener("seeked", () => {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(video.src);
            blob ? resolve(blob) : reject(new Error("Could not capture frame"));
          },
          "image/jpeg",
          0.82
        );
      });
      video.addEventListener("error", () => reject(new Error("Video failed to load")));
    });
  }

  async function uploadFile(file) {
    setUploadStatus("Uploading video...");
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/admin/clips/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) {
      setUploadStatus(`Upload failed: ${data.error}`);
      return;
    }
    setSingle((s) => ({ ...s, video_url: data.url }));
    setUploadStatus("Video uploaded — grabbing a thumbnail frame...");

    try {
      const blob = await captureThumbnail(file);
      const thumbFile = new File([blob], `thumb-${Date.now()}.jpg`, { type: "image/jpeg" });
      const thumbForm = new FormData();
      thumbForm.append("file", thumbFile);
      const thumbRes = await fetch("/api/admin/clips/upload", { method: "POST", body: thumbForm });
      const thumbData = await thumbRes.json();
      if (thumbRes.ok) {
        setSingle((s) => ({ ...s, thumbnail_url: thumbData.url }));
        setUploadStatus("Video and thumbnail uploaded.");
      } else {
        setUploadStatus("Video uploaded — thumbnail failed, you can add one manually below.");
      }
    } catch {
      setUploadStatus("Video uploaded — thumbnail failed, you can add one manually below.");
    }
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
        const thumbForm = new FormData();
        thumbForm.append("file", thumbFile);
        const thumbRes = await fetch("/api/admin/clips/upload", { method: "POST", body: thumbForm });
        const thumbData = await thumbRes.json();
        if (thumbRes.ok) thumbnail_url = thumbData.url;
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
    if (!confirm(`Delete "${clip.title}"? This removes its votes and comments too.`)) return;
    const res = await fetch(`/api/admin/clips?id=${clip.id}`, { method: "DELETE" });
    if (res.ok) setClips((cs) => cs.filter((c) => c.id !== clip.id));
  }

  return (
    <div className="space-y-10">
      <section className="border border-chalk/30 rounded-md p-4">
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

      <section>
        <h2 className="font-mono text-xs uppercase tracking-wide opacity-60 mb-2">Add one clip</h2>
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
                uploadFile(file);
              }}
              className="text-xs"
            />
          </label>
          {uploadStatus && <p className="col-span-2 text-xs font-mono opacity-70">{uploadStatus}</p>}
          <input
            value={single.video_url}
            onChange={(e) => setSingle({ ...single, video_url: e.target.value })}
            placeholder="Video URL (fills in automatically after upload, or paste one)"
            className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk col-span-2"
          />
          <input
            value={single.thumbnail_url}
            onChange={(e) => setSingle({ ...single, thumbnail_url: e.target.value })}
            placeholder="Thumbnail URL (auto-generated after upload)"
            className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk col-span-2"
          />
          <input
            value={single.source_credit}
            onChange={(e) => setSingle({ ...single, source_credit: e.target.value })}
            placeholder="Source credit (optional)"
            className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk col-span-2"
          />
          <button className="self-start border border-line rounded-md px-4 py-2 text-sm font-mono hover:border-chalk col-span-2">
            Add clip
          </button>
        </form>
      </section>

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
          {filteredClips.map((clip) => (
            <div
              key={clip.id}
              className={`flex items-center gap-2 border border-line rounded-md px-3 py-2 text-sm ${
                clip.hidden ? "opacity-40" : ""
              }`}
            >
              <span className="flex-1 truncate">{clip.title}</span>
              <EditableField clip={clip} field="video_url" placeholder="video url" onSave={saveField} />
              <EditableField clip={clip} field="thumbnail_url" placeholder="thumb url" onSave={saveField} />
              <CreditInput clip={clip} onSave={saveCredit} />
              <button
                onClick={() => toggleHide(clip)}
                className="font-mono text-xs opacity-70 hover:opacity-100"
              >
                {clip.hidden ? "unhide" : "hide"}
              </button>
              <button
                onClick={() => deleteClip(clip)}
                className="font-mono text-xs text-trash opacity-80 hover:opacity-100"
              >
                delete
              </button>
            </div>
          ))}
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
