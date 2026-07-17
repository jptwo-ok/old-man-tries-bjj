import { supabasePublic, supabaseAdmin } from "@/lib/supabase";
import ClipGrid from "@/components/ClipGrid";
import ColoredBio from "@/components/ColoredBio";

export const dynamic = "force-dynamic";

async function getData() {
  const supabase = supabasePublic();

  const [{ data: clips }, { data: votes }, { data: copySetting }, { data: latestBatch }] =
    await Promise.all([
      supabase.from("clips").select("*").eq("hidden", false).order("added_at", { ascending: false }),
      supabase.from("votes").select("clip_id, vote_type"),
      supabase.from("site_settings").select("value").eq("key", "site_copy").single(),
      supabase
        .from("upload_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single(),
    ]);

  return {
    clips: clips || [],
    votes: votes || [],
    copy: copySetting?.value || {},
    latestBatch: latestBatch || null,
  };
}

export default async function HomePage() {
  const { clips, votes, copy, latestBatch } = await getData();

  await supabaseAdmin().from("page_views").insert({ path: "home" });

  const voteCounts = {};
  for (const v of votes) {
    if (!voteCounts[v.clip_id]) voteCounts[v.clip_id] = { SKIP_IT: 0, LEGIT: 0, IFFY: 0 };
    voteCounts[v.clip_id][v.vote_type]++;
  }

  const newBadgeDays = copy.newBadgeDays ?? 7;

  return (
    <main className="max-w-4xl mx-auto px-3 pt-8 pb-16">
      <header className="flex flex-col items-start text-left gap-2 mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-wide">{copy.name || "Old Man Tries BJJ"}</h1>
        <p className="font-mono text-sm opacity-70">{copy.handle || "@OldManTriesBJJ"} · oldmantriesbjj.com</p>
        <ColoredBio text={copy.bio} className="max-w-lg text-sm leading-relaxed opacity-90" />
      </header>

      {latestBatch && (
        <div className="border border-line rounded-md px-4 py-2 mb-6 text-center text-sm font-mono opacity-90">
          + {latestBatch.clip_count} new clips added
          {latestBatch.note ? ` — ${latestBatch.note}` : ""}
        </div>
      )}

      <ClipGrid
        clips={clips}
        voteCounts={voteCounts}
        newBadgeDays={newBadgeDays}
        unratedPosition={copy.unratedPosition || "top"}
        excludedWords={copy.excludedSearchWords || []}
      />
    </main>
  );
}
