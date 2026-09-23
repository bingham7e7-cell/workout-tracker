"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { describeError, timeoutSignal } from "@/lib/client/errors";

export function SetActivePlanButton({ planId, active }: { planId: string; active: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setActive() {
    if (busy || active) return;
    setBusy(true);
    setError(null);
    const { data: claims } = await getSupabaseBrowser().auth.getClaims();
    const { error } = await getSupabaseBrowser()
      .from("profiles")
      .update({ active_plan_id: planId })
      .eq("id", claims?.claims?.sub ?? "")
      .abortSignal(timeoutSignal());
    setBusy(false);
    if (error) return setError(describeError(error));
    router.refresh();
  }

  if (active) {
    return <span className="flex h-9 shrink-0 items-center rounded-lg bg-emerald-950 px-3 text-sm font-semibold text-emerald-400">Active</span>;
  }
  return (
    <div className="shrink-0 text-right">
      <button onClick={setActive} disabled={busy} className="h-9 rounded-lg bg-zinc-800 px-3 text-sm font-medium disabled:opacity-50">
        {busy ? "…" : "Set active"}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
