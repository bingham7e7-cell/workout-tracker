"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { describeError, timeoutSignal } from "@/lib/client/errors";

export function DeleteWorkoutButton({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    if (busy) return;
    if (!window.confirm(`Permanently delete "${name}"?\n\nThis can't be undone.`)) return;
    setBusy(true);
    setError(null);
    const { error } = await getSupabaseBrowser().from("workouts").delete().eq("id", id).abortSignal(timeoutSignal());
    if (error) {
      setBusy(false);
      setError(describeError(error));
      return;
    }
    router.replace("/history");
    router.refresh();
  }

  return (
    <>
      {error && <p className="mt-4 rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
      <button onClick={remove} disabled={busy} className="mt-4 h-12 w-full text-red-400 disabled:opacity-50">
        {busy ? "Deleting…" : "Delete workout"}
      </button>
    </>
  );
}
