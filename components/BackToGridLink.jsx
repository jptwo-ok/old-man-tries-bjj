"use client";

import { useRouter } from "next/navigation";

export default function BackToGridLink() {
  const router = useRouter();

  const handleBack = () => {
    const idx = typeof window !== "undefined" ? window.history.state?.idx : undefined;
    if (idx && idx > 0) {
      router.back();
    } else {
      router.push("/");
    }
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      className="font-mono text-xs opacity-70 hover:opacity-100"
    >
      back
    </button>
  );
}
