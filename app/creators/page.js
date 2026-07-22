import { supabasePublic } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

const MIN_VOTES = 10; // creators need at least this many total votes across their clips to be ranked
const UNKNOWN_CREDIT = "Unknown — help us ID this";

async function getCreatorStats() {
  const supabase = supabasePublic();
  const [{ data: clips }, { data: votes }] = await Promise.all([
    supabase.from("clips").select("id, source_credit").eq("hidden", false),
    supabase.from("votes").select("clip_id, vote_type"),
  ]);

  const clipCredit = {};
  for (const c of clips || []) clipCredit[c.id] = c.source_credit || UNKNOWN_CREDIT;

  const stats = {}; // credit -> { UP, DOWN, total, clipIds:Set }
  for (const c of clips || []) {
    const credit = c.source_credit || UNKNOWN_CREDIT;
    if (!stats[credit]) stats[credit] = { UP: 0, DOWN: 0, total: 0, clips: new Set() };
    stats[credit].clips.add(c.id);
  }
  for (const v of votes || []) {
    const credit = clipCredit[v.clip_id];
    if (!credit || !stats[credit]) continue;
    stats[credit][v.vote_type]++;
    stats[credit].total++;
  }

  const rows = Object.entries(stats)
    .filter(([credit]) => credit !== UNKNOWN_CREDIT)
    .map(([credit, s]) => ({
      credit,
      clipCount: s.clips.size,
      totalVotes: s.total,
      upScore: s.total ? Math.round((s.UP / s.total) * 100) : 0,
      UP: s.UP,
      DOWN: s.DOWN,
    }));

  const ranked = rows.filter((r) => r.totalVotes >= MIN_VOTES);
  const unranked = rows.filter((r) => r.totalVotes < MIN_VOTES);
  const unknownCount = stats[UNKNOWN_CREDIT]?.clips.size || 0;

  const highest = [...ranked].sort((a, b) => b.upScore - a.upScore).slice(0, 10);
  const lowest = [...ranked].sort((a, b) => a.upScore - b.upScore).slice(0, 10);

  return { highest, lowest, unrankedCount: unranked.length, unknownCount };
}

function CreatorRow({ row, rank }) {
  return (
    <div className="flex items-center gap-3 border border-line rounded-md px-3 py-2">
      <span className="font-mono text-xs opacity-40 w-5">{rank}</span>
      <span className="flex-1 text-sm truncate">{row.credit}</span>
      <span className="font-mono text-xs opacity-60">{row.clipCount} clips</span>
      <span className="font-mono text-xs opacity-60">{row.totalVotes} votes</span>
      <span className="font-mono text-sm font-semibold text-legit">{row.upScore}% 👍</span>
    </div>
  );
}

export default async function CreatorsPage() {
  const { highest, lowest, unrankedCount, unknownCount } = await getCreatorStats();

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <Link href="/" className="font-mono text-xs opacity-70 hover:opacity-100">
        ← back to grid
      </Link>

      <h1 className="font-display text-xl font-semibold mt-4 mb-1">Creator ratings</h1>
      <p className="text-xs opacity-60 mb-6 font-mono">
        Ranked by % of votes that were thumbs up. Needs at least {MIN_VOTES} votes across a creator's clips
        to be ranked ({unrankedCount} creator{unrankedCount === 1 ? "" : "s"} below that threshold,{" "}
        {unknownCount} clip{unknownCount === 1 ? "" : "s"} not yet credited to anyone).
      </p>

      <section className="mb-8">
        <h2 className="font-mono text-xs uppercase tracking-wide opacity-60 mb-2">Highest rated</h2>
        <div className="space-y-1">
          {highest.length === 0 && (
            <p className="font-mono text-xs opacity-40">Not enough voted, credited clips yet.</p>
          )}
          {highest.map((row, i) => (
            <CreatorRow key={row.credit} row={row} rank={i + 1} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-mono text-xs uppercase tracking-wide opacity-60 mb-2">Lowest rated</h2>
        <div className="space-y-1">
          {lowest.length === 0 && (
            <p className="font-mono text-xs opacity-40">Not enough voted, credited clips yet.</p>
          )}
          {lowest.map((row, i) => (
            <CreatorRow key={row.credit} row={row} rank={i + 1} />
          ))}
        </div>
      </section>
    </main>
  );
}
