"use client";

import { useState, useRef } from "react";
import { supabasePublic } from "@/lib/supabase";
import { getVoterCookie } from "@/lib/voterCookie";
import { beltColor } from "@/lib/belts";
import BeltSelect from "@/components/BeltSelect";

export default function CommentSection({ clipId, initialComments }) {
  const [comments, setComments] = useState(initialComments);
  const [name, setName] = useState("");
  const [belt, setBelt] = useState(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const lastPostRef = useRef(0);

  async function submit(e) {
    e.preventDefault();
    setError("");

    const trimmedBody = body.trim();
    const trimmedName = name.trim();
    if (!trimmedBody) return;
    if (!trimmedName) {
      setError("Name required — any name works, no account needed.");
      return;
    }
    if (!belt) {
      setError("Pick a belt.");
      return;
    }

    const now = Date.now();
    if (now - lastPostRef.current < 60_000) {
      setError("One comment at a time — try again in a bit.");
      return;
    }

    const cookie = getVoterCookie();
    const { data, error: insertError } = await supabasePublic()
      .from("comments")
      .insert({
        clip_id: clipId,
        voter_cookie: cookie,
        author_name: trimmedName,
        belt,
        body: trimmedBody,
      })
      .select()
      .single();

    if (insertError) {
      setError("Comment didn't post — try again.");
      return;
    }

    lastPostRef.current = now;
    setComments((c) => [...c, data]);
    setBody("");
  }

  return (
    <div className="mt-8">
      <h2 className="font-mono text-xs uppercase tracking-wide opacity-60 mb-3">
        Comments ({comments.length})
      </h2>

      <div className="space-y-3 mb-4">
        {comments.map((c) => (
          <div key={c.id} className="border border-line rounded-md px-3 py-2 text-sm">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="w-3 h-3 rounded-full border border-line shrink-0"
                style={{ background: beltColor(c.belt) }}
                title={c.belt || undefined}
              />
              <span className="font-mono text-xs opacity-70">{c.author_name || "Anonymous"}</span>
            </div>
            {c.body}
            <div className="font-mono text-[10px] opacity-40 mt-1">
              {new Date(c.created_at).toLocaleString()}
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="font-mono text-xs opacity-40">No comments yet.</p>
        )}
      </div>

      <form onSubmit={submit} className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="flex-1 bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk"
            maxLength={50}
          />
          <BeltSelect value={belt} onChange={setBelt} />
        </div>
        <div className="flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Comment"
            className="flex-1 bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk"
            maxLength={500}
          />
          <button
            type="submit"
            className="border border-line rounded-md px-4 py-2 text-sm font-mono hover:border-chalk"
          >
            Post
          </button>
        </div>
      </form>
      {error && <p className="text-trash text-xs font-mono mt-2">{error}</p>}
    </div>
  );
}