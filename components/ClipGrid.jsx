"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import VotePanel from "@/components/VotePanel";
import { supabasePublic } from "@/lib/supabase";
import { getVoterCookie } from "@/lib/voterCookie";

function thumbUrl(clip) {
  return clip.thumbnail_url || null;
}

const gradeColor = {
  UP: "bg-legit",
  DOWN: "bg-trash",
};

const GRADE_ORDER = ["UP", "DOWN"];

function sortClipsForDisplay(clipsToSort, voteCounts, unratedPosition) {
  const rated = [];
  const unrated = [];
  for (const clip of clipsToSort) {
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
}

const CATEGORY_ORDER = ["Standup", "Guard Pass", "Top Game", "Bottom Game", "Leg Game"];
const UNCATEGORIZED = "Uncategorized";

// Kebab-case anchor id for a category section (e.g. "Guard Pass" -> "guard-pass"),
// used so the homepage "Jump to:" nav links can scroll to the right section.
function categoryToId(category) {
  return category.toLowerCase().replace(/\s+/g, "-");
}

// Orders featured clips by category (CATEGORY_ORDER, anything else last), then
// by the same vote-score logic used within a regular category section.
function sortFeaturedClips(clipsToSort, voteCounts) {
  const orderIndex = (cat) => {
    const idx = CATEGORY_ORDER.indexOf(cat);
    return idx === -1 ? CATEGORY_ORDER.length : idx;
  };
  const byCategory = new Map();
  for (const clip of clipsToSort) {
    if (!byCategory.has(clip.category)) byCategory.set(clip.category, []);
    byCategory.get(clip.category).push(clip);
  }
  const categories = [...byCategory.keys()].sort((a, b) => orderIndex(a) - orderIndex(b));
  const result = [];
  for (const cat of categories) {
    result.push(...sortClipsForCategorySection(byCategory.get(cat), voteCounts));
  }
  return result;
}

// Buckets clips into fixed-order category sections (anything not in
// CATEGORY_ORDER — including the literal "Uncategorized" default — falls
// into a final "Uncategorized" bucket). Empty buckets are dropped.
function groupClipsByCategory(clipsToGroup) {
  const buckets = new Map([...CATEGORY_ORDER, UNCATEGORIZED].map((cat) => [cat, []]));
  for (const clip of clipsToGroup) {
    const bucket = buckets.has(clip.category) ? clip.category : UNCATEGORIZED;
    buckets.get(bucket).push(clip);
  }
  return [...buckets.entries()]
    .map(([category, clips]) => ({ category, clips }))
    .filter((section) => section.clips.length > 0);
}

const STOPWORDS = new Set([
  "a", "an", "the", "to", "of", "in", "on", "at", "for", "and", "or", "but",
  "with", "from", "by", "is", "are", "was", "were", "be", "been", "this",
  "that", "these", "those", "it", "its", "as", "into", "than", "then",
  "over", "under", "up", "down", "out", "off", "no", "not", "so", "if",
  "when", "while", "your", "you", "i", "my", "vs", "you're",
]);

// First word of a title that isn't a stopword — used to group unrated
// clips by rough subject in sortClipsForCategorySection below.
function extractPrimaryKeyword(title) {
  const rawWords = (title || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return rawWords.find((w) => !STOPWORDS.has(w)) || "";
}

// Two-tier sort used only for the grouped/category view:
// Tier 1 — clips with at least one thumbs-up, ranked by score (UP*2 - DOWN*1),
// newest as tiebreak. Tier 2 — everything else, alphabetized by primary
// subject keyword, newest first within the same keyword. Tier 1 always
// comes first. (sortClipsForDisplay is unchanged and still drives the flat
// search view.)
function sortClipsForCategorySection(clipsToSort, voteCounts) {
  const tier1 = [];
  const tier2 = [];
  for (const clip of clipsToSort) {
    const v = voteCounts[clip.id];
    (v && v.UP > 0 ? tier1 : tier2).push(clip);
  }

  tier1.sort((a, b) => {
    const scoreOf = (c) => {
      const v = voteCounts[c.id] || { UP: 0, DOWN: 0 };
      return v.UP * 2 - v.DOWN * 1;
    };
    const diff = scoreOf(b) - scoreOf(a);
    return diff !== 0 ? diff : new Date(b.added_at) - new Date(a.added_at);
  });

  tier2.sort((a, b) => {
    const kwDiff = extractPrimaryKeyword(a.title).localeCompare(extractPrimaryKeyword(b.title));
    return kwDiff !== 0 ? kwDiff : new Date(b.added_at) - new Date(a.added_at);
  });

  return [...tier1, ...tier2];
}

// How long (ms) a finger has to stay down before it counts as a long-press
// (navigate to the clip's own page) instead of a tap (expand in place).
const LONG_PRESS_MS = 450;
// If the finger moves more than this many px before release, treat it as a
// scroll, not a tap or a hold — cancels both behaviors.
const MOVE_CANCEL_PX = 10;

export default function ClipGrid({ clips: initialClips, voteCounts, unratedPosition = "top", featuredClipId = null, excludedWords = [], isAdmin = false }) {
  const [clips, setClips] = useState(initialClips);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  // Only one tile can be expanded (mobile tap-to-expand) at a time.
  const [expandedId, setExpandedId] = useState(null);

  async function toggleFeatured(clip) {
    const nextFeatured = !clip.featured;
    setClips((cs) => cs.map((c) => (c.id === clip.id ? { ...c, featured: nextFeatured } : c)));

    const res = await fetch("/api/admin/clips", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: clip.id, featured: nextFeatured }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setClips((cs) => cs.map((c) => (c.id === clip.id ? { ...c, featured: !nextFeatured } : c)));
      alert(`Error: ${data.error || "Could not update featured status"}`);
    }
  }

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

  const hasActiveSearch = search.trim() !== "";

  // Flat, ungrouped, featured-pinned list — used only while a search is active.
  const sortedClips = useMemo(() => {
    const sorted = sortClipsForDisplay(searchedClips, voteCounts, unratedPosition);

    if (hasActiveSearch || !featuredClipId) return sorted;

    const featuredClip = searchedClips.find((clip) => clip.id === featuredClipId);
    if (!featuredClip) return sorted;

    return [featuredClip, ...sorted.filter((clip) => clip.id !== featuredClip.id)];
  }, [featuredClipId, searchedClips, hasActiveSearch, voteCounts, unratedPosition]);

  // Grouped-by-category sections — used for the default (no search) view.
  // Each section is sorted independently with the two-tier keyword sort.
  const groupedSections = useMemo(() => {
    return groupClipsByCategory(searchedClips).map((section) => ({
      category: section.category,
      clips: sortClipsForCategorySection(section.clips, voteCounts),
    }));
  }, [searchedClips, voteCounts]);

  // Manually-curated Featured section — shown above Standup in the grouped
  // view, ordered by category then by the usual vote-score logic.
  const featuredSection = useMemo(() => {
    const featured = searchedClips.filter((clip) => clip.featured);
    return featured.length > 0 ? sortFeaturedClips(featured, voteCounts) : [];
  }, [searchedClips, voteCounts]);

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
        <nav className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[11px]">
          <span className="opacity-50">Jump to:</span>
          <a href="#standup" className="underline opacity-60 hover:opacity-100">Standup</a>
          <a href="#guard-pass" className="underline opacity-60 hover:opacity-100">Guard Pass</a>
          <a href="#top-game" className="underline opacity-60 hover:opacity-100">Top Game</a>
          <a href="#bottom-game" className="underline opacity-60 hover:opacity-100">Bottom Game</a>
          <a href="#leg-game" className="underline opacity-60 hover:opacity-100">Leg Game</a>
        </nav>
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

      <div className="flex items-center justify-between mb-2 gap-3">
        <span className="font-mono text-xs opacity-80 shrink-0">{clips.length} clips</span>
        <div className="flex flex-col items-end gap-1">
          <Link href="/about" className="font-mono text-[11px] underline opacity-60 hover:opacity-100">
            Contact
          </Link>
          <a href="https://ko-fi.com/oldmantriesbjj" target="_blank" rel="noopener noreferrer" className="font-mono text-[11px] underline opacity-60 hover:opacity-100">Buy me a coffee</a>
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

      {hasActiveSearch ? (
        sortedClips.length === 0 ? (
          <p className="text-center opacity-60 text-sm py-16 font-mono">No clips match "{search}".</p>
        ) : (
          <div className="grid gap-[2px] grid-cols-4">
            {sortedClips.map((clip) =>
              renderClipTile(clip, { voteCounts, featuredClipId, search, expandedId, setExpandedId, isAdmin, onToggleFeatured: toggleFeatured })
            )}
          </div>
        )
      ) : (
        <div className="space-y-5">
          {featuredSection.length > 0 && (
            <div className="featured-section-glow rounded-md">
              <div className="font-mono text-[11px] opacity-50 mb-1.5">Featured</div>
              <div className="grid gap-[2px] grid-cols-4">
                {featuredSection.map((clip) =>
                  renderClipTile(clip, { voteCounts, featuredClipId, search, expandedId, setExpandedId, isAdmin, onToggleFeatured: toggleFeatured })
                )}
              </div>
            </div>
          )}
          {groupedSections.map((section) => (
            <div key={section.category} id={categoryToId(section.category)}>
              <div className="font-mono text-[11px] opacity-50 mb-1.5">{section.category}</div>
              <div className="grid gap-[2px] grid-cols-4">
                {section.clips.map((clip) =>
                  renderClipTile(clip, { voteCounts, featuredClipId, search, expandedId, setExpandedId, isAdmin, onToggleFeatured: toggleFeatured })
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <style jsx global>{`
        @keyframes featuredSectionGlow {
          0%, 100% {
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.12), 0 0 14px 3px rgba(255, 255, 255, 0.06), 0 0 30px 8px rgba(255, 255, 255, 0.04);
          }
          50% {
            box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.22), 0 0 24px 6px rgba(255, 255, 255, 0.12), 0 0 50px 14px rgba(255, 255, 255, 0.07);
          }
        }

        .featured-section-glow {
          animation: featuredSectionGlow 3.6s ease-in-out infinite;
          position: relative;
          z-index: 1;
        }
      `}</style>
    </div>
  );
}

function renderClipTile(clip, { voteCounts, featuredClipId, search, expandedId, setExpandedId, isAdmin, onToggleFeatured }) {
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
      isFeatured={featuredClipId === clip.id && !search.trim()}
      isExpanded={expandedId === clip.id}
      setExpandedId={setExpandedId}
      isAdmin={isAdmin}
      onToggleFeatured={onToggleFeatured}
    />
  );
}

function ClipTile({ clip, counts, unrated, thumb, isNewClip, isFeatured, isExpanded, setExpandedId, isAdmin, onToggleFeatured }) {
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

  // Preview timing for hover / tap-preview analytics
  const previewStartRef = useRef(null);
  const previewPlayingRef = useRef(false);

  // The moment this tile expands, scroll it to the vertical center of the
  // screen — otherwise a tile near the bottom expands partly off-screen
  // and needs a manual scroll to see the whole thing.
  useEffect(() => {
    if (isExpanded && tileRef.current) {
      tileRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [isExpanded]);

  // Start/stop preview timing for hover or expanded previews.
  useEffect(() => {
    const shouldPreview = clip.video_url && (isExpanded || hovering);
    if (shouldPreview) startPreview();
    else stopPreview();
    return () => {
      if (previewPlayingRef.current) stopPreview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isExpanded, hovering, clip.video_url]);

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

  function handleClick(e) {
    e.preventDefault();
    setExpandedId(isExpanded ? null : clip.id);
  }

  async function recordHoverIfNeeded(durationMs) {
    try {
      if (durationMs < 1000) return;
      const cookie = getVoterCookie();
      const supabase = supabasePublic();
      await supabase.from("hover_events").insert([
        { clip_id: clip.id, voter_cookie: cookie, duration_ms: Math.round(durationMs), created_at: new Date().toISOString() },
      ]);
    } catch (err) {
      console.error("Failed to record hover event", err);
    }
  }

  function startPreview() {
    if (previewPlayingRef.current) return;
    previewPlayingRef.current = true;
    previewStartRef.current = Date.now();
  }

  function stopPreview() {
    if (!previewPlayingRef.current) return;
    previewPlayingRef.current = false;
    const start = previewStartRef.current || 0;
    const duration = Date.now() - start;
    previewStartRef.current = null;
    recordHoverIfNeeded(duration);
  }

  return (
    <>
      <style jsx global>{`
        @keyframes featuredGlow {
          0%, 100% {
            box-shadow: 0 0 0 2px rgba(74, 222, 128, 0.5), 0 0 20px 4px rgba(74, 222, 128, 0.35), 0 0 45px 12px rgba(74, 222, 128, 0.2);
          }
          50% {
            box-shadow: 0 0 0 3px rgba(74, 222, 128, 0.9), 0 0 40px 12px rgba(74, 222, 128, 0.65), 0 0 80px 24px rgba(74, 222, 128, 0.4);
          }
        }

        .featured-clip-glow {
          animation: featuredGlow 2.2s ease-in-out infinite;
          position: relative;
          z-index: 1;
        }
      `}</style>
      <Link
        ref={tileRef}
        href={`/clip/${clip.id}`}
        className={`relative bg-line overflow-hidden group block aspect-square ${
          isExpanded ? "col-span-4" : ""
        } ${isFeatured ? "featured-clip-glow" : ""}`}
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
        style={{ WebkitTouchCallout: "none" }}
      >
      {isExpanded && clip.video_url ? (
        // Expanded view — plays with sound on desktop click-expand or mobile tap-expand.
        // object-contain (not object-cover) so vertical clips letterbox with black bars
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
        <>
          <VotePanel clipId={clip.id} initialCounts={counts} insetPercent={5} size="small" />
          <button
            type="button"
            onTouchStart={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              router.push(`/clip/${clip.id}`);
            }}
            aria-label="Open clip page"
            className="absolute top-3 right-3 z-10 pointer-events-auto rounded-full bg-black/70 p-2 text-chalk hover:bg-black/90"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 11V5h6" />
              <path d="M5 5l6 6" />
              <path d="M19 13v6h-6" />
              <path d="M19 19l-6-6" />
            </svg>
          </button>
        </>
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

      {(isNewClip || isFeatured) && !isExpanded && (
        <span className="absolute top-1 left-1 font-mono text-[9px] bg-chalk text-mat px-1 rounded-sm tracking-wide">
          NEW
        </span>
      )}

      {isAdmin && !isExpanded && (
        <button
          type="button"
          onTouchStart={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onToggleFeatured(clip);
          }}
          aria-label={clip.featured ? "Remove from Featured" : "Add to Featured"}
          className="absolute top-1 right-1 z-10 pointer-events-auto"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill={clip.featured ? "white" : "none"}
            stroke="white"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.8))" }}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
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
    </>
  );
}