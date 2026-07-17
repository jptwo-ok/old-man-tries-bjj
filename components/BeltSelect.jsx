"use client";

import { useState } from "react";
import { BELTS } from "@/lib/belts";

export default function BeltSelect({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = BELTS.find((b) => b.key === value);

  return (
    <div className="relative inline-block shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 border border-line rounded-md px-3 py-2 text-sm hover:border-chalk h-full"
      >
        <span
          className="w-4 h-4 rounded-full border border-line shrink-0"
          style={{ background: selected ? selected.color : "transparent" }}
        />
        <span className="font-mono text-xs opacity-70 whitespace-nowrap">Your Rank</span>
      </button>

      {open && (
        <div className="absolute z-10 top-full right-0 mt-1 flex gap-1.5 bg-mat border border-line rounded-md p-2">
          {BELTS.map((b) => (
            <button
              key={b.key}
              type="button"
              title={b.key}
              aria-label={b.key}
              onClick={() => {
                onChange(b.key);
                setOpen(false);
              }}
              className={`w-6 h-6 rounded-full hover:scale-110 transition-transform ${
                b.border ? "border border-line" : ""
              }`}
              style={{ background: b.color }}
            />
          ))}
        </div>
      )}
    </div>
  );
}