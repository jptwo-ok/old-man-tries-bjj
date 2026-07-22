import { supabasePublic, supabaseAdmin } from "@/lib/supabase";
import VotePanel from "@/components/VotePanel";
import Link from "next/link";
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

export default async function ClipPage({ params }) {
  const { clip, votes } = await getClip(params.id);
  if (!clip) notFound();

  await supabaseAdmin().from("page_views").insert({ path: `clip:${params.id}` });

  const counts = { UP: 0, DOWN: 0 };
  for (const v of votes) counts[v.vote_type]++;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/" className="font-mono text-xs opacity-70 hover:opacity-100">
        ← back to grid
      </Link>

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
  );
}
