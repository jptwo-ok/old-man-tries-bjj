"use client";

import { useEffect, useRef } from "react";
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

  // Desktop keyboard navigation — mirrors the touch swipe above.
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "ArrowRight" && nextId) {
        router.push(`/clip/${nextId}`);
      } else if (e.key === "ArrowLeft" && prevId) {
        router.push(`/clip/${prevId}`);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [prevId, nextId, router]);

  return (
    <div className="relative" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
      {prevId && (
        <button
          type="button"
          onClick={() => router.push(`/clip/${prevId}`)}
          aria-label="Previous clip"
          className="hidden md:flex fixed left-4 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-10 h-10 rounded-full bg-black/70 text-chalk hover:bg-black/90"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
      )}
      {nextId && (
        <button
          type="button"
          onClick={() => router.push(`/clip/${nextId}`)}
          aria-label="Next clip"
          className="hidden md:flex fixed right-4 top-1/2 -translate-y-1/2 z-10 items-center justify-center w-10 h-10 rounded-full bg-black/70 text-chalk hover:bg-black/90"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}
      {children}
    </div>
  );
}
