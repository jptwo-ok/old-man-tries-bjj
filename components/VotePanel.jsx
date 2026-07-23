"use client";

import { useState, useEffect } from "react";
import { supabasePublic } from "@/lib/supabase";
import { getVoterCookie } from "@/lib/voterCookie";

export default function VotePanel({ clipId, initialCounts, insetPercent = 15 }) {
  const [counts, setCounts] = useState(initialCounts);
  const [myVote, setMyVote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);

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
        setChecked(true);
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

  // Don't show the overlay until we've checked for an existing vote, and hide it
  // entirely once a vote is cast — that's the whole point of it disappearing.
  if (!checked || myVote) return null;

  return (
    <div
      className="absolute inset-0 flex items-center justify-between pointer-events-none"
      style={{ paddingLeft: `${insetPercent}%`, paddingRight: `${insetPercent}%` }}
    >
      <button
        onClick={() => castVote("UP")}
        disabled={busy}
        aria-label="Thumbs up"
        className="pointer-events-auto w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-105"
        style={{ background: "rgba(110, 139, 94, 0.75)" }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
          <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      </button>
      <button
        onClick={() => castVote("DOWN")}
        disabled={busy}
        aria-label="Thumbs down"
        className="pointer-events-auto w-16 h-16 rounded-full flex items-center justify-center transition-transform hover:scale-105"
        style={{ background: "rgba(156, 74, 61, 0.75)" }}
      >
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
          <path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
        </svg>
      </button>
    </div>
  );
}