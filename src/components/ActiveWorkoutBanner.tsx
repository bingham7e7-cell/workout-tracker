"use client";

import Link from "next/link";
import { useActiveDraft } from "@/lib/client/draftStorage";
import { countSets } from "@/lib/domain/draft";

export function ActiveWorkoutBanner() {
  const { draft } = useActiveDraft();
  if (!draft) return null;
  const { logged } = countSets(draft);
  const finishing = Boolean(draft.finishedAt);
  return (
    <Link
      href="/workout"
      className={`mb-4 flex items-center justify-between rounded-2xl p-4 text-zinc-950 ${finishing ? "bg-sky-400" : "bg-emerald-500"}`}
    >
      <div>
        <div className="text-sm font-medium opacity-80">{finishing ? "Finished — not saved yet" : "In progress"}</div>
        <div className="text-lg font-bold">{draft.name}</div>
        <div className="text-sm opacity-80">{logged} sets logged</div>
      </div>
      <span className="text-lg font-bold">{finishing ? "Details →" : "Resume →"}</span>
    </Link>
  );
}
