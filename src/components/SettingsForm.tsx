"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { clearOfflineExercises } from "@/lib/client/exerciseLibraryCache";
import { clearPreviousSetsCache } from "@/lib/client/previousSetsCache";
import { describeError, timeoutSignal } from "@/lib/client/errors";
import type { WeightUnit } from "@/lib/domain/units";

export function SettingsForm({ unit: initialUnit, email }: { unit: WeightUnit; email: string }) {
  const router = useRouter();
  const [unit, setUnit] = useState(initialUnit);
  const [error, setError] = useState<string | null>(null);

  async function changeUnit(next: WeightUnit) {
    if (next === unit) return;
    const previous = unit;
    setUnit(next);
    setError(null);
    const { data: claims } = await getSupabaseBrowser().auth.getClaims();
    const { error } = await getSupabaseBrowser()
      .from("profiles")
      .update({ weight_unit: next })
      .eq("id", claims?.claims?.sub ?? "")
      .abortSignal(timeoutSignal());
    if (error) {
      setUnit(previous);
      setError(describeError(error));
      return;
    }
    router.refresh();
  }

  async function signOut() {
    await getSupabaseBrowser().auth.signOut();
    // These caches (Stage 3, offline support) hold this account's exercise names and
    // recent set history. Clear them so a shared phone never shows one person's data
    // to the next account before the first background refresh completes.
    clearOfflineExercises();
    clearPreviousSetsCache();
    if (typeof caches !== "undefined") {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 font-semibold">Weight unit</h2>
        <p className="mb-3 text-sm text-zinc-400">
          Weights are always stored precisely, so you can switch at any time. A workout already in progress keeps
          the unit it started with.
        </p>
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-zinc-900 p-1">
          {(["lb", "kg"] as const).map((u) => (
            <button
              key={u}
              onClick={() => changeUnit(u)}
              className={`h-12 rounded-lg text-lg font-semibold ${unit === u ? "bg-emerald-500 text-zinc-950" : "text-zinc-300"}`}
            >
              {u === "lb" ? "Pounds (lb)" : "Kilograms (kg)"}
            </button>
          ))}
        </div>
        {error && <p className="mt-3 rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
      </section>

      <section>
        <h2 className="mb-1 font-semibold">Account</h2>
        <p className="mb-3 text-sm text-zinc-400">Signed in as {email}</p>
        <button onClick={signOut} className="h-12 w-full rounded-xl bg-zinc-800 font-medium">
          Sign out
        </button>
      </section>
    </div>
  );
}
