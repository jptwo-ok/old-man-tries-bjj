"use client";

import { useRouter } from "next/navigation";

export default function BackToGridLink() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="font-mono text-xs opacity-70 hover:opacity-100"
    >
      back
    </button>
  );
}
