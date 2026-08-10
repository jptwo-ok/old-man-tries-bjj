"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";

// Minimum horizontal distance (px) for a release to count as a swipe
// (rather than a scroll) — matches ClipGrid's expanded-tile swipe.
const SWIPE_THRESHOLD_PX = 50;

export default function ClipSwipeNav({ prevId, nextId, children }) {
  const router = useRouter();
  const touchStartPos = useRef({ x: 0, y: 0 });

  function handleTouchStart(e) {
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY };
  }

  function handleTouchEnd(e) {
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStartPos.current.x;
    const dy = t.clientY - touchStartPos.current.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;

    if (dx < 0 && nextId) {
      router.push(`/clip/${nextId}`);
    } else if (dx > 0 && prevId) {
      router.push(`/clip/${prevId}`);
    }
  }

  return (
    <div onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {children}
    </div>
  );
}
