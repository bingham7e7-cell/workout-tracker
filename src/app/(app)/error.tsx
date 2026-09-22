"use client";

import { useEffect } from "react";

export default function AppError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="mt-16 space-y-4 text-center">
      <h2 className="text-xl font-semibold">Couldn&apos;t load this page</h2>
      <p className="text-zinc-400">
        This is usually a connection problem. Any workout in progress is safe on this phone.
      </p>
      <button onClick={reset} className="h-12 rounded-xl bg-zinc-800 px-6 font-medium">
        Try again
      </button>
    </div>
  );
}
