"use client";

import { useState } from "react";

// Admin-only ranking nudge, separate from the public vote count entirely —
// adjusts clips.admin_boost via PATCH, never touches the votes table.
export default function AdminBoostControl({ clipId, initialBoost, onBoostChange }) {
  const [boost, setBoost] = useState(initialBoost);
  const [busy, setBusy] = useState(false);

  async function adjust(delta) {
    if (busy) return;
    setBusy(true);

    const prevBoost = boost;
    const nextBoost = prevBoost + delta;
    setBoost(nextBoost);
    if (onBoostChange) onBoostChange(clipId, nextBoost);

    const res = await fetch("/api/admin/clips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: clipId, admin_boost: nextBoost }),
    });

    if (!res.ok) {
      setBoost(prevBoost);
      if (onBoostChange) onBoostChange(clipId, prevBoost);
    }
    setBusy(false);
  }

  function handleDecrement(e) {
    e.stopPropagation();
    e.preventDefault();
    adjust(-1);
  }

  function handleIncrement(e) {
    e.stopPropagation();
    e.preventDefault();
    adjust(1);
  }

  return (
    <div className="absolute bottom-3 right-3 z-10 pointer-events-auto flex items-center gap-1 rounded-full bg-black/70 px-2 py-1 text-chalk">
      <button
        type="button"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={handleDecrement}
        onClick={handleDecrement}
        disabled={busy}
        aria-label="Decrease boost"
        className="w-5 h-5 flex items-center justify-center font-mono text-sm leading-none hover:opacity-70 disabled:opacity-40"
      >
        −
      </button>
      <span className="font-mono text-[11px] font-semibold min-w-[14px] text-center">{boost}</span>
      <button
        type="button"
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={handleIncrement}
        onClick={handleIncrement}
        disabled={busy}
        aria-label="Increase boost"
        className="w-5 h-5 flex items-center justify-center font-mono text-sm leading-none hover:opacity-70 disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
