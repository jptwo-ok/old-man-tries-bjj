import { supabaseAdmin } from "@/lib/supabase";

async function getStats() {
  const supabase = supabaseAdmin();
  const [{ count: clipCount }, { count: voteCount }, { count: commentCount }, { count: totalViews }, { count: homeViews }, { count: hoverCount }, { data: hoverRows }, { data: clipViewRows }, { data: voteRows }, { data: clips }] =
    await Promise.all([
      supabase.from("clips").select("*", { count: "exact", head: true }),
      supabase.from("votes").select("*", { count: "exact", head: true }),
      supabase.from("comments").select("*", { count: "exact", head: true }),
      supabase.from("page_views").select("*", { count: "exact", head: true }),
      supabase.from("page_views").select("*", { count: "exact", head: true }).eq("path", "home"),
      supabase.from("hover_events").select("*", { count: "exact", head: true }),
      supabase.from("hover_events").select("voter_cookie, clip_id, duration_ms"),
      supabase.from("page_views").select("path").like("path", "clip:%"),
      supabase.from("votes").select("voter_cookie"),
      supabase.from("clips").select("id, title"),
    ]);

  const titleById = Object.fromEntries((clips || []).map((c) => [c.id, c.title]));
  const viewCounts = {};
  for (const row of clipViewRows || []) {
    const id = row.path.replace("clip:", "");
    viewCounts[id] = (viewCounts[id] || 0) + 1;
  }
  const topClips = Object.entries(viewCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id, count]) => ({ title: titleById[id] || "(deleted clip)", count }));

  // Hover engagement stats
  const totalHoverCount = hoverCount || 0;
  let avgHoverDurationSec = 0;
  let avgDistinctClipsPerVisitor = 0;
  let percentHoverVisitorsWhoVoted = 0;
  if (hoverRows && hoverRows.length > 0) {
    const totalMs = hoverRows.reduce((s, r) => s + (r.duration_ms || 0), 0);
    avgHoverDurationSec = Math.round((totalMs / hoverRows.length) / 10) / 100; // round to 2 decimals

    const byVisitor = {};
    for (const r of hoverRows) {
      const c = r.voter_cookie || "(anon)";
      byVisitor[c] = byVisitor[c] || new Set();
      if (r.clip_id) byVisitor[c].add(r.clip_id);
    }
    const counts = Object.values(byVisitor).map((s) => s.size);
    avgDistinctClipsPerVisitor = counts.length ? Math.round((counts.reduce((a, b) => a + b, 0) / counts.length) * 100) / 100 : 0;

    const hoverCookies = new Set(Object.keys(byVisitor));
    const voteCookieSet = new Set((voteRows || []).map((v) => v.voter_cookie).filter(Boolean));
    const hoveredThenVoted = Array.from(hoverCookies).filter((c) => voteCookieSet.has(c)).length;
    percentHoverVisitorsWhoVoted = hoverCookies.size ? Math.round((hoveredThenVoted / hoverCookies.size) * 100) : 0;
  }

  return {
    clipCount: clipCount || 0,
    voteCount: voteCount || 0,
    commentCount: commentCount || 0,
    totalViews: totalViews || 0,
    homeViews: homeViews || 0,
    topClips,
    hoverStats: {
      totalHoverCount,
      avgHoverDurationSec,
      avgDistinctClipsPerVisitor,
      percentHoverVisitorsWhoVoted,
    },
  };
}

export default async function AdminDashboard() {
  const { clipCount, voteCount, commentCount, totalViews, homeViews, topClips, hoverStats } = await getStats();

  return (
    <div>
      <h1 className="font-display text-lg font-semibold mb-6">Dashboard</h1>
      <div className="grid grid-cols-3 gap-3 font-mono text-sm mb-3">
        <div className="border border-line rounded-md p-4 text-center">
          <div className="text-2xl">{clipCount}</div>
          <div className="opacity-60 text-xs mt-1">clips</div>
        </div>
        <div className="border border-line rounded-md p-4 text-center">
          <div className="text-2xl">{voteCount}</div>
          <div className="opacity-60 text-xs mt-1">votes</div>
        </div>
        <div className="border border-line rounded-md p-4 text-center">
          <div className="text-2xl">{commentCount}</div>
          <div className="opacity-60 text-xs mt-1">comments</div>
        </div>
      </div>
      <div className="mt-4">
        <h2 className="font-mono text-xs uppercase tracking-wide opacity-60 mb-2">Hover Engagement</h2>
        <div className="grid grid-cols-4 gap-3 font-mono text-sm mb-6">
          <div className="border border-line rounded-md p-4 text-center">
            <div className="text-2xl">{hoverStats.totalHoverCount}</div>
            <div className="opacity-60 text-xs mt-1">hover events</div>
          </div>
          <div className="border border-line rounded-md p-4 text-center">
            <div className="text-2xl">{hoverStats.avgHoverDurationSec}</div>
            <div className="opacity-60 text-xs mt-1">avg duration (s)</div>
          </div>
          <div className="border border-line rounded-md p-4 text-center">
            <div className="text-2xl">{hoverStats.avgDistinctClipsPerVisitor}</div>
            <div className="opacity-60 text-xs mt-1">avg distinct clips/visitor</div>
          </div>
          <div className="border border-line rounded-md p-4 text-center">
            <div className="text-2xl">{hoverStats.percentHoverVisitorsWhoVoted}%</div>
            <div className="opacity-60 text-xs mt-1">hover visitors who voted</div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 font-mono text-sm mb-6">
        <div className="border border-line rounded-md p-4 text-center">
          <div className="text-2xl">{totalViews}</div>
          <div className="opacity-60 text-xs mt-1">total page views</div>
        </div>
        <div className="border border-line rounded-md p-4 text-center">
          <div className="text-2xl">{homeViews}</div>
          <div className="opacity-60 text-xs mt-1">homepage views</div>
        </div>
      </div>
      {topClips.length > 0 && (
        <div>
          <h2 className="font-mono text-xs uppercase tracking-wide opacity-60 mb-2">Most viewed clips</h2>
          <div className="space-y-1">
            {topClips.map((c) => (
              <div key={c.title} className="flex justify-between border border-line rounded-md px-3 py-2 text-sm">
                <span className="truncate">{c.title}</span>
                <span className="font-mono opacity-70">{c.count} views</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
