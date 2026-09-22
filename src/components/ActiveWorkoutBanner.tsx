"use client";

import Link from "next/link";
import { useActiveDraft } from "@/lib/client/draftStorage";
import { countSets } from "@/lib/domain/draft";

export function ActiveWorkoutBanner() {
  const { draft } = useActiveDraft();
  if (!draft) return null;
  const { logged } = countSets(draft);
  return (
    <Link
      href="/workout"
      className="mb-4 flex items-center justify-between rounded-2xl bg-emerald-500 p-4 text-zinc-950"
    >
      <div>
        <div className="text-sm font-medium opacity-80">In progress</div>
        <div className="text-lg font-bold">{draft.name}</div>
        <div className="text-sm opacity-80">{logged} sets logged</div>
      </div>
      <span className="text-lg font-bold">Resume →</span>
    </Link>
  );
}
