"use client";

import { useState, useEffect, useRef } from "react";
import { supabasePublic } from "@/lib/supabase";
import { getVoterCookie } from "@/lib/voterCookie";

export default function VotePanel({ clipId, initialCounts, insetPercent = 15, size = "large" }) {
  const [counts, setCounts] = useState(initialCounts);
  const [myVote, setMyVote] = useState(null);
  const [busy, setBusy] = useState(false);
  const [checked, setChecked] = useState(false);
  // True only when a vote is cast during THIS visit (not one loaded from a
  // prior session) — controls whether we show the light-up-then-fade
  // animation, versus a returning vote just staying hidden immediately.
  const [sessionVoted, setSessionVoted] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const fadeTimer = useRef(null);

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
    return () => {
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, [clipId]);

  async function castVote(voteType) {
    if (busy || voteType === myVote) return;
    setBusy(true);

    // Light up immediately on tap — don't wait for the network round trip.
    const prevVote = myVote;
    setMyVote(voteType);
    setSessionVoted(true);
    setCounts((c) => {
      const next = { ...c };
      if (prevVote) next[prevVote] = Math.max(0, next[prevVote] - 1);
      next[voteType] = (next[voteType] || 0) + 1;
      return next;
    });

    // Start the fade-out now — thumbs light up, then fade while the video
    // keeps playing, rather than vanishing the instant you tap.
    if (fadeTimer.current) clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => setFadeOut(true), 900);

    const cookie = getVoterCookie();
    const supabase = supabasePublic();
    const { error } = await supabase
      .from("votes")
      .upsert(
        { clip_id: clipId, voter_cookie: cookie, vote_type: voteType },
        { onConflict: "clip_id,voter_cookie" }
      );

    if (error) {
      // Roll back the optimistic update if the write actually failed.
      setMyVote(prevVote);
      setCounts((c) => {
        const next = { ...c };
        next[voteType] = Math.max(0, next[voteType] - 1);
        if (prevVote) next[prevVote] = (next[prevVote] || 0) + 1;
        return next;
      });
    }
    setBusy(false);
  }

  function handleTouchEnd(e, voteType) {
    e.preventDefault();
    e.stopPropagation();
    castVote(voteType);
  }

  function handleClick(e, voteType) {
    e.preventDefault();
    e.stopPropagation();
    castVote(voteType);
  }

  if (!checked) return null;
  // A vote from a previous visit — nothing to animate, stay hidden exactly
  // like before.
  if (myVote && !sessionVoted) return null;

  const buttonClass = size === "small" ? "w-10 h-10" : "w-16 h-16";
  const iconSize = size === "small" ? 18 : 30;

  return (
    <div
      className={`absolute inset-0 flex items-center justify-between transition-opacity duration-700 ${
        fadeOut ? "opacity-0 pointer-events-none" : "opacity-100 pointer-events-none"
      }`}
      style={{ paddingLeft: `${insetPercent}%`, paddingRight: `${insetPercent}%` }}
    >
      <button
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => handleTouchEnd(e, "UP")}
        onClick={(e) => handleClick(e, "UP")}
        disabled={busy}
        aria-label="Thumbs up"
        className={`pointer-events-auto ${buttonClass} rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 ${
          myVote === "UP" ? "scale-110 ring-4 ring-white/70" : ""
        }`}
        style={{ background: "rgba(110, 139, 94, 0.9)" }}
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
          <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      </button>
      <button
        onTouchStart={(e) => e.stopPropagation()}
        onTouchEnd={(e) => handleTouchEnd(e, "DOWN")}
        onClick={(e) => handleClick(e, "DOWN")}
        disabled={busy}
        aria-label="Thumbs down"
        className={`pointer-events-auto ${buttonClass} rounded-full flex items-center justify-center transition-all duration-200 hover:scale-105 ${
          myVote === "DOWN" ? "scale-110 ring-4 ring-white/70" : ""
        }`}
        style={{ background: "rgba(156, 74, 61, 0.9)" }}
      >
        <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10z" />
          <path d="M17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3" />
        </svg>
      </button>
    </div>
  );
}