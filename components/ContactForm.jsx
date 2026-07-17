"use client";

import { useState } from "react";
import { supabasePublic } from "@/lib/supabase";
import BeltSelect from "@/components/BeltSelect";

export default function ContactForm({ onClose }) {
  const [name, setName] = useState("");
  const [belt, setBelt] = useState(null);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("");

  async function submit(e) {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedMessage = message.trim();
    if (!trimmedName || !trimmedMessage) {
      setStatus("Name and message are both required.");
      return;
    }

    const { error } = await supabasePublic()
      .from("private_messages")
      .insert({ name: trimmedName, belt, message: trimmedMessage });

    if (error) {
      setStatus("Didn't send — try again.");
      return;
    }

    setStatus("Sent — thanks, this goes straight to me.");
    setName("");
    setBelt(null);
    setMessage("");
  }

  return (
    <div className="border border-line rounded-md p-3 mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-xs uppercase tracking-wide opacity-70">
          Questions, comments, or want to host your clips?
        </p>
        <button onClick={onClose} className="font-mono text-xs opacity-50 hover:opacity-100">
          close
        </button>
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
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Comment"
          rows={3}
          className="bg-transparent border border-line rounded-md px-3 py-2 text-sm outline-none focus:border-chalk"
          maxLength={1000}
        />
        <button className="self-start border border-line rounded-md px-4 py-2 text-sm font-mono hover:border-chalk">
          Send
        </button>
        {status && <p className="text-xs font-mono opacity-70">{status}</p>}
      </form>
    </div>
  );
}