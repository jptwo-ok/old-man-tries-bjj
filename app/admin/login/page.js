"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError("Wrong password.");
    }
  }

  return (
    <main className="max-w-sm mx-auto px-4 py-24">
      <h1 className="font-display text-xl font-semibold mb-6 text-center">Admin</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          className="bg-transparent border border-line rounded-md px-3 py-2 outline-none focus:border-chalk"
        />
        <button
          type="submit"
          className="border border-line rounded-md px-4 py-2 font-mono text-sm hover:border-chalk"
        >
          Log in
        </button>
        {error && <p className="text-trash text-xs font-mono">{error}</p>}
      </form>
    </main>
  );
}
