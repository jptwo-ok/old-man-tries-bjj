"use client";

import { useRef } from "react";

const SKIP_SECONDS = 5;

// Wraps the native video player so skip buttons can share a ref with it —
// setting currentTime directly (rather than pausing first) doesn't
// interrupt playback if the video is already playing.
export default function ClipVideoPlayer({ videoUrl, thumbnailUrl, children }) {
  const videoRef = useRef(null);

  function skip(deltaSeconds) {
    const video = videoRef.current;
    if (!video) return;
    const duration = Number.isFinite(video.duration) ? video.duration : Infinity;
    video.currentTime = Math.min(Math.max(video.currentTime + deltaSeconds, 0), duration);
  }

  return (
    <>
      <div className="relative aspect-video bg-line rounded-md overflow-hidden">
        {videoUrl ? (
          <video
            ref={videoRef}
            className="w-full h-full"
            src={videoUrl}
            poster={thumbnailUrl || undefined}
            controls
            preload="metadata"
            playsInline
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center font-mono text-sm opacity-50">
            No video linked yet
          </div>
        )}
        {children}
      </div>
      {videoUrl && (
        <div className="mt-2 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => skip(-SKIP_SECONDS)}
            aria-label="Skip back 5 seconds"
            className="flex items-center gap-1 border border-line rounded-md px-3 py-1.5 font-mono text-xs opacity-80 hover:opacity-100 hover:border-chalk"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 2.6-6.4" />
              <polyline points="3 4 3 10 9 10" />
            </svg>
            5
          </button>
          <button
            type="button"
            onClick={() => skip(SKIP_SECONDS)}
            aria-label="Skip forward 5 seconds"
            className="flex items-center gap-1 border border-line rounded-md px-3 py-1.5 font-mono text-xs opacity-80 hover:opacity-100 hover:border-chalk"
          >
            5
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.6-6.4" />
              <polyline points="21 4 21 10 15 10" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
