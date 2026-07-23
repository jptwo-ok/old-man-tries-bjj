"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VotePanel from "@/components/VotePanel";

function thumbUrl(clip) {
  return clip.thumbnail_url || null;
}

const gradeColor = {
  UP: "bg-legit",
  DOWN: "bg-trash",
};

const GRADE_ORDER = ["UP", "DOWN"];

const STOPWORDS = new Set([
  "a", "an", "the", "to", "of", "in", "on", "at", "for", "and", "or", "but",
  "with", "from", "by", "is", "are", "was", "were", "be", "been", "this",
  "that", "these", "those", "it", "its", "as", "into", "than", "then",
  "over", "under", "up", "down", "out", "off", "no", "not", "so", "if",
  "when", "while", "your", "you", "i", "my", "vs", "you're",
]);

// How long (ms) a finger has to stay down before it counts as a long-press
// (navigate to the clip's own page) instead of a tap (expand in place).
const LONG_PRESS_MS = 450;
// If the finger moves more than this many px before release, treat it as a
// scroll, not a tap or a hold — cancels both behaviors.
const MOVE_CANCEL_PX = 10;

export default function ClipGrid({ clips, voteCounts, unratedPosition = "top", excludedWords = [] }) {
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  // Only one tile can be expanded (mobile tap-to-expand) at a time.
  const [expandedId, setExpandedId] = useState(null);

  const excludedSet = useMemo(() => {
    const set = new Set(STOPWORDS);
    for (const entry of excludedWords) {
      for (const w of entry.toLowerCase().trim().split(/\s+/)) {
        if (w) set.add(w);
      }
    }
    return set;
  }, [excludedWords]);

  const wordList = useMemo(() => {
    const phrases = new Set();
    for (const clip of clips) {
      const rawWords = (clip.title || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
      const words = rawWords.filter((w) => !excludedSet.has(w));

      for (const w of words) phrases.add(w);

      for (let i = 0; i < rawWords.length - 1; i++) {
        if (excludedSet.has(rawWords[i]) || excludedSet.has(rawWords[i + 1])) continue;
        phrases.add(`${rawWords[i]} ${rawWords[i + 1]}`);
      }
    }
    return [...phrases].sort();
  }, [clips, excludedSet]);

  const searchedClips = useMemo(() => {
    if (!search.trim()) return clips;
    const term = search.trim().toLowerCase();
    return clips.filter((c) => (c.title || "").toLowerCase().includes(term));
  }, [clips, search]);

  const sortedClips = useMemo(() => {
    const rated = [];
    const unrated = [];
    for (const clip of searchedClips) {
      const c = voteCounts[clip.id];
      const total = c ? c.UP + c.DOWN : 0;
      (total === 0 ? unrated : rated).push(clip);
    }
    rated.sort((a, b) => {
      const scoreOf = (c) => {
        const v = voteCounts[c.id] || { UP: 0, DOWN: 0 };
        return v.UP * 2 - v.DOWN * 1;
      };
      const diff = scoreOf(b) - scoreOf(a);
      return diff !== 0 ? diff : new Date(b.added_at) - new Date(a.added_at);
    });
    unrated.sort((a, b) => new Date(b.added_at) - new Date(a.added_at));

    return unratedPosition === "bottom" ? [...rated, ...unrated] : [...unrated, ...rated];
  }, [searchedClips, voteCounts, unratedPosition]);

  if (clips.length === 0) {
    return (
      <p className="text-center opacity-60 text-sm py-16 font-mono">
        No clips yet. First batch coming soon.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2 gap-3">
        <span className="font-mono text-xs opacity-80 shrink-0">{clips.length} clips</span>
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end gap-1">
            <a href="https://ko-fi.com/oldmantriesbjj" target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] underline opacity-60 hover:opacity-100">Tip</a>
            <Link href="/about" className="font-mono text-[11px] underline opacity-60 hover:opacity-100">
              About
            </Link>
          </div>
          <button
            onClick={() => setSearchOpen((o) => !o)}
            aria-label="Search techniques"
            className="w-7 h-7 flex items-center justify-center border border-line rounded-md hover:border-chalk shrink-0"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="mb-4">
          <input
            list="clip-word-list"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search techniques..."
            autoFocus
            className="w-full bg-transparent border border-line rounded-md px-3 py-2 text-sm font-mono outline-none focus:border-chalk"
          />
          <datalist id="clip-word-list">
            {wordList.map((w) => (
              <option key={w} value={w} />
            ))}
          </datalist>
        </div>
      )}

      {sortedClips.length === 0 ? (
        <p className="text-center opacity-60 text-sm py-16 font-mono">No clips match "{search}".</p>
      ) : (
      <div className={`grid gap-[2px] ${expandedId ? "grid-cols-4" : "grid-cols-3"}`}>
        {sortedClips.map((clip) => {
          const counts = voteCounts[clip.id] || { UP: 0, DOWN: 0 };
          const total = counts.UP + counts.DOWN;
          const unrated = total === 0;
          const thumb = thumbUrl(clip);
          return (
            <ClipTile
              key={clip.id}
              clip={clip}
              counts={counts}
              unrated={unrated}
              thumb={thumb}
              isNewClip={unrated}
              isExpanded={expandedId === clip.id}
              setExpandedId={setExpandedId}
            />
          );
        })}
      </div>
      )}
    </div>
  );
}

function ClipTile({ clip, counts, unrated, thumb, isNewClip, isExpanded, setExpandedId }) {
  // Desktop-only hover preview — unrelated to mobile tap/hold logic below.
  const [hovering, setHovering] = useState(false);
  const [showDots, setShowDots] = useState(false);
  const fadeTimer = useRef(null);
  const router = useRouter();
  const tileRef = useRef(null);

  // Mobile touch-gesture tracking.
  const longPressTimer = useRef(null);
  const longPressFired = useRef(false);
  const movedRef = useRef(false);
  const touchStartPos = useRef({ x: 0, y: 0 });

  // The moment this tile expands, scroll it to the vertical center of the
  // screen — otherwise a tile near the bottom expands partly off-screen
  // and needs a manual scroll to see the whole thing.
  useEffect(() => {
    if (isExpanded && tileRef.current) {
      tileRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isExpanded]);

  function handleEnter() {
    setHovering(true);
    setShowDots(true);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setShowDots(false), 1400);
  }

  function handleLeave() {
    setHovering(false);
    setShowDots(false);
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
  }

  function handleTouchStart(e) {
    movedRef.current = false;
    longPressFired.current = false;
    const t = e.touches[0];
    touchStartPos.current = { x: t.clientX, y: t.clientY };

    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      router.push(`/clip/${clip.id}`);
    }, LONG_PRESS_MS);
  }

  function handleTouchMove(e) {
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchStartPos.current.x);
    const dy = Math.abs(t.clientY - touchStartPos.current.y);
    if (dx > MOVE_CANCEL_PX || dy > MOVE_CANCEL_PX) {
      movedRef.current = true;
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }

  function handleTouchEnd(e) {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    if (longPressFired.current) {
      // Already navigated to the clip page — stop the browser's follow-up
      // click from also firing (which would otherwise re-trigger Link nav).
      e.preventDefault();
      return;
    }

    if (movedRef.current) {
      // Finger moved — this was a scroll, not a tap. Do nothing.
      return;
    }

    // Genuine tap: block the default Link click-navigation and toggle
    // this tile's expanded state instead.
    e.preventDefault();
    setExpandedId(isExpanded ? null : clip.id);
  }

  return (
    <Link
      ref={tileRef}
      href={`/clip/${clip.id}`}
      className={`relative bg-line overflow-hidden group block aspect-square ${
        isExpanded ? "col-span-4" : ""
      }`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: "none" }}
    >
      {isExpanded && clip.video_url ? (
        // Mobile expanded view — plays with sound, no mute. object-contain
        // (not object-cover) so vertical clips letterbox with black bars
        // left/right at this square size, instead of cropping or stretching.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={clip.video_url}
          autoPlay
          playsInline
          loop
          className="w-full h-full object-contain"
        />
      ) : hovering && clip.video_url ? (
        // Desktop hover preview — stays muted, unchanged from before.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={clip.video_url}
          autoPlay
          muted
          loop
          playsInline
          className="w-full h-full object-cover"
        />
      ) : thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt={clip.title} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-[10px] font-mono opacity-50 px-2 text-center">
          {clip.title}
        </div>
      )}

      {isExpanded && (
        // Wrapper stops taps on the vote buttons from bubbling up and
        // being treated as a tap-to-collapse on the tile itself. preventDefault
        // on click is required (not just stopPropagation) to reliably block
        // this Link's own navigation from firing as a side effect of the tap.
        <div
          className="absolute inset-0"
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
          }}
        >
          <VotePanel clipId={clip.id} initialCounts={counts} insetPercent={5} size="small" />
        </div>
      )}

      {hovering && !isExpanded && clip.video_url && (
        <div className="hover-only absolute bottom-1.5 inset-x-0 justify-center pointer-events-none">
          <span
            className="font-mono text-[11px] font-semibold tracking-wide text-chalk px-3 py-1 rounded-full bg-black/80"
          >
            click to vote
          </span>
        </div>
      )}

      {isNewClip && !isExpanded && (
        <span className="absolute top-1 left-1 font-mono text-[9px] bg-chalk text-mat px-1 rounded-sm tracking-wide">
          NEW
        </span>
      )}

      {thumb && !hovering && !isExpanded && (
        <div className="absolute inset-0 flex items-center justify-center px-2 pointer-events-none">
          <p
            className="text-xs leading-tight text-chalk text-center font-medium"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 3,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textShadow: "0 1px 3px rgba(0,0,0,0.9), 0 1px 10px rgba(0,0,0,0.7)",
            }}
          >
            {clip.title}
          </p>
        </div>
      )}

      {!isExpanded && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors pointer-events-none" />
      )}

      {!unrated && !isExpanded && (
        <div
          className={`absolute inset-0 flex items-center justify-center gap-3 transition-opacity duration-300 ${
            showDots ? "opacity-100" : "opacity-0"
          }`}
        >
          {GRADE_ORDER.map((grade) => (
            <div key={grade} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${gradeColor[grade]}`} />
              <span className="font-mono text-[10px] text-chalk">{counts[grade]}</span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}