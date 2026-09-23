"use client";

import { useEffect } from "react";

/** Registers the offline service worker. Renders nothing. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Not critical: the app still works online without it.
      });
    }
  }, []);
  return null;
}
