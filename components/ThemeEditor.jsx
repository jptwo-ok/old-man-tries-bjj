"use client";

import { useState } from "react";

const COLOR_FIELDS = [
  ["colorBg", "Background"],
  ["colorText", "Text"],
  ["colorLegit", "Thumbs up"],
  ["colorTrash", "Thumbs down"],
  ["colorLine", "Lines / borders"],
];

const FONT_FIELDS = [
  ["fontDisplay", "Display font (headings)"],
  ["fontBody", "Body font"],
  ["fontMono", "Mono font (stats)"],
];

export default function ThemeEditor({ initialTheme, initialCopy }) {
  const [theme, setTheme] = useState(initialTheme || {});
  const [copy, setCopy] = useState(initialCopy || {});
  const [excludedWordsText, setExcludedWordsText] = useState(
    (initialCopy?.excludedSearchWords || []).join(", ")
  );
  const [status, setStatus] = useState("");

  async function saveTheme(e) {
    e.preventDefault();
    setStatus("Saving...");
    const excludedSearchWords = excludedWordsText
      .split(",")
      .map((w) => w.trim())
      .filter(Boolean);
    const res = await fetch("/api/admin/theme", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ theme, copy: { ...copy, excludedSearchWords } }),
    });
    setStatus(res.ok ? "Saved." : "Error saving.");
  }

  return (
    <form onSubmit={saveTheme} className="space-y-8">
      <section>
        <h2 className="font-mono text-xs uppercase tracking-wide opacity-60 mb-3">Colors</h2>
        <div className="grid grid-cols-2 gap-3">
          {COLOR_FIELDS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="color"
                value={theme[key] || "#000000"}
                onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
                className="w-8 h-8 border border-line rounded"
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-wide opacity-60 mb-3">Fonts</h2>
        <div className="space-y-2">
          {FONT_FIELDS.map(([key, label]) => (
            <label key={key} className="flex flex-col gap-1 text-sm">
              {label}
              <input
                value={theme[key] || ""}
                onChange={(e) => setTheme({ ...theme, [key]: e.target.value })}
                className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk"
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-wide opacity-60 mb-3">Site copy</h2>
        <div className="space-y-2">
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input
              value={copy.name || ""}
              onChange={(e) => setCopy({ ...copy, name: e.target.value })}
              className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Handle
            <input
              value={copy.handle || ""}
              onChange={(e) => setCopy({ ...copy, handle: e.target.value })}
              className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Bio
            <textarea
              value={copy.bio || ""}
              onChange={(e) => setCopy({ ...copy, bio: e.target.value })}
              rows={3}
              className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Unrated clips show at
            <select
              value={copy.unratedPosition || "top"}
              onChange={(e) => setCopy({ ...copy, unratedPosition: e.target.value })}
              className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk w-40"
            >
              <option value="top">Top of grid</option>
              <option value="bottom">Bottom of grid</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Words to hide from search suggestions
            <textarea
              value={excludedWordsText}
              onChange={(e) => setExcludedWordsText(e.target.value)}
              rows={3}
              placeholder="comma-separated, e.g. escape, guard, from"
              className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk"
            />
            <span className="text-xs opacity-50">
              Common filler words (a, the, to, etc.) are already hidden automatically — use this for
              anything else that's cluttering the search box.
            </span>
          </label>
        </div>
      </section>

      <button className="border border-line rounded-md px-5 py-2 text-sm font-mono hover:border-chalk">
        Save changes
      </button>
      {status && <p className="text-xs font-mono opacity-70">{status}</p>}
    </form>
  );
}