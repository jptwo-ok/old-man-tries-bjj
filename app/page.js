import { supabasePublic, supabaseAdmin } from "@/lib/supabase";
import ClipGrid from "@/components/ClipGrid";
import ColoredBio from "@/components/ColoredBio";
import { isAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

async function getData() {
  const supabase = supabasePublic();

  const [{ data: clips }, { data: votes }, { data: copySetting }] = await Promise.all([
    supabase.from("clips").select("*").eq("hidden", false).order("added_at", { ascending: false }),
    supabase.from("votes").select("clip_id, vote_type"),
    supabase.from("site_settings").select("value").eq("key", "site_copy").single(),
  ]);

  return {
    clips: clips || [],
    votes: votes || [],
    copy: copySetting?.value || {},
  };
}

export default async function HomePage() {
  const { clips, votes, copy } = await getData();

  await supabaseAdmin().from("page_views").insert({ path: "home" });

  const voteCounts = {};
  for (const v of votes) {
    if (!voteCounts[v.clip_id]) voteCounts[v.clip_id] = { UP: 0, DOWN: 0 };
    voteCounts[v.clip_id][v.vote_type]++;
  }

  return (
    <main className="max-w-4xl mx-auto px-3 pt-8 pb-16">
      <header className="flex flex-col items-start text-left gap-2 mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-wide">{copy.name || "Old Man Tries BJJ"}</h1>
        <p className="font-mono text-sm opacity-70">{copy.handle || "@OldManTriesBJJ"} · oldmantriesbjj.com</p>
        <ColoredBio text={copy.bio} className="max-w-lg text-sm leading-relaxed opacity-90" />
      </header>

      <nav className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[11px] mb-4">
        <span className="opacity-50">Jump to:</span>
        <a href="#standup" className="underline opacity-60 hover:opacity-100">Standup</a>
        <a href="#guard-pass" className="underline opacity-60 hover:opacity-100">Guard Pass</a>
        <a href="#top-game" className="underline opacity-60 hover:opacity-100">Top Game</a>
        <a href="#bottom-game" className="underline opacity-60 hover:opacity-100">Bottom Game</a>
        <a href="#leg-game" className="underline opacity-60 hover:opacity-100">Leg Game</a>
      </nav>

      <ClipGrid
        clips={clips}
        voteCounts={voteCounts}
        unratedPosition={copy.unratedPosition || "top"}
        // Featured-clip pinning/glow is disabled on the public homepage for now.
        // The admin "feature" setting and its UI stay fully intact — just not
        // wired into this page. Pass copy.featuredClipId again to re-enable.
        featuredClipId={null}
        excludedWords={copy.excludedSearchWords || []}
        isAdmin={isAdmin()}
      />
    </main>
  );
}