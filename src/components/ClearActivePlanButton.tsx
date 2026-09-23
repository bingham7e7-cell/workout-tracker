"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { describeError, timeoutSignal } from "@/lib/client/errors";

/** Lets the user go back to "no active plan" (a plain Start button on the home screen) without deleting the plan. */
export function ClearActivePlanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function clear() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { data: claims } = await getSupabaseBrowser().auth.getClaims();
    const { error } = await getSupabaseBrowser()
      .from("profiles")
      .update({ active_plan_id: null })
      .eq("id", claims?.claims?.sub ?? "")
      .abortSignal(timeoutSignal());
    setBusy(false);
    if (error) return setError(describeError(error));
    router.refresh();
  }

  return (
    <div className="mb-5">
      <button onClick={clear} disabled={busy} className="h-11 rounded-xl bg-zinc-800 px-4 text-sm font-medium disabled:opacity-50">
        {busy ? "…" : "Clear active plan"}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
