"use client";

import { useState } from "react";

export default function AnnouncePage() {
  const [count, setCount] = useState(0);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState("");

  async function submit(e) {
    e.preventDefault();
    const res = await fetch("/api/admin/announce", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ count: Number(count), note }),
    });
    setStatus(res.ok ? "Posted to homepage banner." : "Error.");
    if (res.ok) {
      setCount(0);
      setNote("");
    }
  }

  return (
    <div>
      <h1 className="font-display text-lg font-semibold mb-2">Announce</h1>
      <p className="text-xs opacity-60 mb-6">
        Bulk imports post this automatically. Use this only if you want to post a manual update — e.g.
        after editing categories or adding YouTube IDs to clips already imported.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-2 max-w-sm">
        <input
          type="number"
          value={count}
          onChange={(e) => setCount(e.target.value)}
          placeholder="Clip count"
          className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (e.g. 'guard passing batch')"
          className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk"
        />
        <button className="self-start border border-line rounded-md px-4 py-2 text-sm font-mono hover:border-chalk">
          Post announcement
        </button>
        {status && <p className="text-xs font-mono opacity-70">{status}</p>}
      </form>
    </div>
  );
}
