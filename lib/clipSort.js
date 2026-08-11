export const CATEGORY_ORDER = ["Standup", "Guard Pass", "Top Game", "Bottom Game", "Leg Game"];
export const UNCATEGORIZED = "Uncategorized";

export const STOPWORDS = new Set([
  "a", "an", "the", "to", "of", "in", "on", "at", "for", "and", "or", "but",
  "with", "from", "by", "is", "are", "was", "were", "be", "been", "this",
  "that", "these", "those", "it", "its", "as", "into", "than", "then",
  "over", "under", "up", "down", "out", "off", "no", "not", "so", "if",
  "when", "while", "your", "you", "i", "my", "vs", "you're",
]);

// First word of a title that isn't a stopword — used to group unrated
// clips by rough subject in sortClipsForCategorySection below.
export function extractPrimaryKeyword(title) {
  const rawWords = (title || "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  return rawWords.find((w) => !STOPWORDS.has(w)) || "";
}

// Shared ranking score: real votes plus an admin's manual boost/negate
// adjustment (clip.admin_boost), kept in its own column so it never mixes
// into the votes table itself.
export function scoreOf(clip, voteCounts) {
  const v = voteCounts[clip.id] || { UP: 0, DOWN: 0 };
  return v.UP * 2 - v.DOWN * 1 + (clip.admin_boost || 0);
}

// Three-tier sort used for the grouped/category view:
// Tier 1 — clips with a positive net score (UP*2 - DOWN*1 + admin_boost > 0),
// ranked by score descending, newest as tiebreak. Tier 2 — clips with no
// votes at all and no admin_boost, alphabetized by primary subject keyword,
// newest first within the same keyword. Tier 3 — everything else (at least
// one vote, or a nonzero admin_boost, with a non-positive net score), ranked
// by score ascending (worst at the very bottom), newest as tiebreak. Render
// order is tier 1, tier 2, tier 3.
export function sortClipsForCategorySection(clipsToSort, voteCounts) {
  const tier1 = [];
  const tier2 = [];
  const tier3 = [];
  for (const clip of clipsToSort) {
    const v = voteCounts[clip.id] || { UP: 0, DOWN: 0 };
    if (scoreOf(clip, voteCounts) > 0) {
      tier1.push(clip);
    } else if (v.UP === 0 && v.DOWN === 0 && (clip.admin_boost || 0) === 0) {
      tier2.push(clip);
    } else {
      tier3.push(clip);
    }
  }

  tier1.sort((a, b) => {
    const diff = scoreOf(b, voteCounts) - scoreOf(a, voteCounts);
    return diff !== 0 ? diff : new Date(b.added_at) - new Date(a.added_at);
  });

  tier2.sort((a, b) => {
    const kwDiff = extractPrimaryKeyword(a.title).localeCompare(extractPrimaryKeyword(b.title));
    return kwDiff !== 0 ? kwDiff : new Date(b.added_at) - new Date(a.added_at);
  });

  tier3.sort((a, b) => {
    const diff = scoreOf(a, voteCounts) - scoreOf(b, voteCounts);
    return diff !== 0 ? diff : new Date(b.added_at) - new Date(a.added_at);
  });

  return [...tier1, ...tier2, ...tier3];
}

// Buckets clips into fixed-order category sections (anything not in
// CATEGORY_ORDER — including the literal "Uncategorized" default — falls
// into a final "Uncategorized" bucket). Empty buckets are dropped.
export function groupClipsByCategory(clipsToGroup) {
  const buckets = new Map([...CATEGORY_ORDER, UNCATEGORIZED].map((cat) => [cat, []]));
  for (const clip of clipsToGroup) {
    const bucket = buckets.has(clip.category) ? clip.category : UNCATEGORIZED;
    buckets.get(bucket).push(clip);
  }
  return [...buckets.entries()]
    .map(([category, clips]) => ({ category, clips }))
    .filter((section) => section.clips.length > 0);
}
