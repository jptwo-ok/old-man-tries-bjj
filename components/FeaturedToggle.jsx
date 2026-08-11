"use client";

import { useState } from "react";

// Admin-only Featured toggle, shared between the collapsed and expanded
// grid tile — PATCHes clips.featured, optimistic with a silent rollback
// on failure (no alert, matching AdminBoostControl's convention).
export default function FeaturedToggle({ clipId, initialFeatured, onFeaturedChange, className, size = 16 }) {
  const [featured, setFeatured] = useState(initialFeatured);
  const [busy, setBusy] = useState(false);

  async function toggle(e) {
    e.stopPropagation();
    e.preventDefault();
    if (busy) return;
    setBusy(true);

    const prevFeatured = featured;
    const nextFeatured = !prevFeatured;
    setFeatured(nextFeatured);
    if (onFeaturedChange) onFeaturedChange(clipId, nextFeatured);

    const res = await fetch("/api/admin/clips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: clipId, featured: nextFeatured }),
    });

    if (!res.ok) {
      setFeatured(prevFeatured);
      if (onFeaturedChange) onFeaturedChange(clipId, prevFeatured);
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={toggle}
      onClick={toggle}
      disabled={busy}
      aria-label={featured ? "Remove from Featured" : "Add to Featured"}
      className={className}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={featured ? "white" : "none"}
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
      >
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}
