"use client";

import { useEffect } from "react";

// Adding a no-op unload listener is a well-known way to make browsers exclude
// a page from the back/forward cache. Without this, hitting the back button to
// return to an admin page can show stale data instead of re-fetching it fresh.
export default function DisableBackForwardCache() {
  useEffect(() => {
    const handler = () => {};
    window.addEventListener("unload", handler);
    return () => window.removeEventListener("unload", handler);
  }, []);

  return null;
}