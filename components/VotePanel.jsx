"use client";

import { useState, useEffect } from "react";
import { supabasePublic } from "@/lib/supabase";
import { getVoterCookie } from "@/lib/voterCookie";

const OPTIONS = [
  { key: "LEGIT", label: "LEGIT", colorVar: "--color-legit" },
  { key: "IFFY", label: "IFFY", colorVar: "--color-situational" },
  { key: "SKIP_IT", label: "SKIP IT", colorVar: "--color-trash" },
];

export default function VotePanel({ clipId, initialCounts }) {
  const [counts, setCounts] = useState(initialCounts);
  const [myVote, setMyVote] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const cookie = getVoterCookie();
    supabasePublic()
      .from("votes")
      .select("vote_type")
      .eq("clip_id", clipId)
      .eq("voter_cookie", cookie)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setMyVote(data.vote_type);
      });
  }, [clipId]);

  async function castVote(voteType) {
    if (busy || voteType === myVote) return;
    setBusy(true);
    const cookie = getVoterCookie();
    const supabase = supabasePublic();

    const prevVote = myVote;
    const { error } = await supabase
      .from("votes")
      .upsert(
        { clip_id: clipId, voter_cookie: cookie, vote_type: voteType },
        { onConflict: "clip_id,voter_cookie" }
      );

    if (!error) {
      setCounts((c) => {
        const next = { ...c };
        if (prevVote) next[prevVote] = Math.max(0, next[prevVote] - 1);
        next[voteType] = (next[voteType] || 0) + 1;
        return next;
      });
      setMyVote(voteType);
    }
    setBusy(false);
  }

  const total = counts.SKIP_IT + counts.LEGIT + counts.IFFY;

  return (
    <div className="mt-6 border border-line rounded-md p-4">
      <div className="grid grid-cols-3 gap-2">
        {OPTIONS.map((opt) => {
          const active = myVote === opt.key;
          const pct = total ? Math.round((counts[opt.key] / total) * 100) : 0;
          return (
            <button
              key={opt.key}
              onClick={() => castVote(opt.key)}
              disabled={busy}
              className={`rounded-md py-3 font-mono text-xs tracking-wide border transition-colors ${
                active ? "border-chalk" : "border-line opacity-80 hover:opacity-100"
              }`}
              style={{ background: active ? `var(${opt.colorVar})` : "transparent" }}
            >
              <div>{opt.label}</div>
              <div className="opacity-70 mt-1">
                {counts[opt.key]} {total ? `(${pct}%)` : ""}
              </div>
            </button>
          );
        })}
      </div>
      <p className="text-center font-mono text-[11px] opacity-50 mt-3">
        {total} total votes {myVote ? "· tap another option to change your vote" : ""}
      </p>
    </div>
  );
}
