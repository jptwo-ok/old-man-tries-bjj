import { headers } from "next/headers";
import { supabasePublic, supabaseAdmin } from "@/lib/supabase";
import VotePanel from "@/components/VotePanel";
import BackToGridLink from "@/components/BackToGridLink";
import ClipSwipeNav from "@/components/ClipSwipeNav";
import { groupClipsByCategory, sortClipsForCategorySection } from "@/lib/clipSort";
import { isBot } from "@/lib/isBot";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

async function getClip(id) {
  const supabase = supabasePublic();
  const [{ data: clip }, { data: votes }] = await Promise.all([
    supabase.from("clips").select("*").eq("id", id).single(),
    supabase.from("votes").select("vote_type").eq("clip_id", id),
  ]);
  return { clip, votes: votes || [] };
}

// Same category-grouped, three-tier-sorted order as the homepage's default
// (no-search) grid view, flattened so swipe can step to the next/previous
// clip in that order.
async function getNeighbors(currentId) {
  const supabase = supabasePublic();
  const [{ data: clips }, { data: allVotes }] = await Promise.all([
    supabase.from("clips").select("*").eq("hidden", false).order("added_at", { ascending: false }),
    supabase.from("votes").select("clip_id, vote_type"),
  ]);

  const voteCounts = {};
  for (const v of allVotes || []) {
    if (!voteCounts[v.clip_id]) voteCounts[v.clip_id] = { UP: 0, DOWN: 0 };
    voteCounts[v.clip_id][v.vote_type]++;
  }

  const ordered = groupClipsByCategory(clips || []).flatMap((section) =>
    sortClipsForCategorySection(section.clips, voteCounts)
  );
  const index = ordered.findIndex((c) => c.id === currentId);
  if (index === -1) return { prevId: null, nextId: null };

  return {
    prevId: index > 0 ? ordered[index - 1].id : null,
    nextId: index < ordered.length - 1 ? ordered[index + 1].id : null,
  };
}

export default async function ClipPage({ params }) {
  const [{ clip, votes }, { prevId, nextId }] = await Promise.all([
    getClip(params.id),
    getNeighbors(params.id),
  ]);
  if (!clip) notFound();

  const userAgent = headers().get("user-agent");
  if (!isBot(userAgent)) {
    await supabaseAdmin().from("page_views").insert({ path: `clip:${params.id}` });
  }

  const counts = { UP: 0, DOWN: 0 };
  for (const v of votes) counts[v.vote_type]++;

  return (
    <ClipSwipeNav prevId={prevId} nextId={nextId}>
      <main className="max-w-2xl mx-auto px-4 py-8">
        <BackToGridLink />

        <h1 className="font-display text-xl font-semibold mt-4">{clip.title}</h1>
        <p className="font-mono text-xs opacity-60 mt-1">
          added {new Date(clip.added_at).toLocaleDateString()} · credit: {clip.source_credit}
        </p>

        <div className="mt-4 relative aspect-video bg-line rounded-md overflow-hidden">
          {clip.video_url ? (
            <video
              className="w-full h-full"
              src={clip.video_url}
              poster={clip.thumbnail_url || undefined}
              controls
              preload="metadata"
              playsInline
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center font-mono text-sm opacity-50">
              No video linked yet
            </div>
          )}
          <VotePanel clipId={clip.id} initialCounts={counts} />
        </div>
      </main>
    </ClipSwipeNav>
  );
}
