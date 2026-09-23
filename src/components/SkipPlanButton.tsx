"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { describeError, timeoutSignal } from "@/lib/client/errors";

export function SkipPlanButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function skip() {
    if (busy) return;
    if (!window.confirm("Skip to the next workout in your plan? This doesn't finish or save anything.")) return;
    setBusy(true);
    setError(null);
    const { error } = await getSupabaseBrowser().rpc("skip_active_plan").abortSignal(timeoutSignal());
    setBusy(false);
    if (error) return setError(describeError(error));
    router.refresh();
  }

  return (
    <div>
      <button onClick={skip} disabled={busy} className="h-11 px-2 text-sm font-medium text-zinc-400 disabled:opacity-50">
        {busy ? "Skipping…" : "Skip →"}
      </button>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}
