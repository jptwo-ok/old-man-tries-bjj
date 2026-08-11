import { headers } from "next/headers";
import { supabasePublic, supabaseAdmin } from "@/lib/supabase";
import ClipGrid from "@/components/ClipGrid";
import ColoredBio from "@/components/ColoredBio";
import { isAdmin } from "@/lib/adminAuth";
import { isBot } from "@/lib/isBot";

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

  const userAgent = headers().get("user-agent");
  await supabaseAdmin().from("page_views").insert({ path: "home", is_bot: isBot(userAgent) });

  const voteCounts = {};
  for (const v of votes) {
    if (!voteCounts[v.clip_id]) voteCounts[v.clip_id] = { UP: 0, DOWN: 0 };
    voteCounts[v.clip_id][v.vote_type]++;
  }

  return (
    <main id="top" className="max-w-4xl mx-auto px-3 pt-8 pb-16">
      <header className="flex flex-col items-start text-left gap-2 mb-6">
        <h1 className="font-display text-2xl font-semibold tracking-wide">{copy.name || "Old Man Tries BJJ"}</h1>
        <p className="font-mono text-sm opacity-70">
          {copy.handle || "@OldManTriesBJJ"} ·{" "}
          <a href="https://jiujitsu.net" target="_blank" rel="noopener noreferrer" className="underline hover:opacity-100">
            jiujitsu.net
          </a>
        </p>
        <ColoredBio text={copy.bio} className="max-w-lg text-sm leading-relaxed opacity-90" />
      </header>

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