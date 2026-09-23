"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { describeError, timeoutSignal } from "@/lib/client/errors";

export function CopyStarterPlanButton({ starterPlanId }: { starterPlanId: string }) {
  const router = useRouter();
  // Generated once (not per click), so retrying after a lost reply reuses
  // the same id instead of copying the starter plan a second time.
  const [planId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function copy() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const { data, error } = await getSupabaseBrowser()
      .rpc("copy_starter_plan", { p_starter_plan_id: starterPlanId, p_plan_id: planId })
      .abortSignal(timeoutSignal());
    setBusy(false);
    if (error) return setError(describeError(error));
    router.push(`/plans/${data as string}`);
    router.refresh();
  }

  return (
    <div>
      <button onClick={copy} disabled={busy} className="h-11 rounded-lg bg-emerald-500 px-4 font-semibold text-zinc-950 disabled:opacity-50">
        {busy ? "Copying…" : "Use this plan"}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
