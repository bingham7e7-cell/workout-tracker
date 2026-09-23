"use client";

import { useState } from "react";
import { BodyDiagram, LEGEND } from "@/components/analytics/BodyDiagram";
import { workloadBucket, type MuscleWorkload } from "@/lib/domain/workload";

const BUCKET_LEGEND_COLOR: Record<string, string> = {
  untrained: "bg-zinc-800",
  light: "bg-sky-500",
  moderate: "bg-emerald-500",
  high: "bg-amber-500",
  very_high: "bg-red-500",
};

export function MuscleWorkloadView({
  workload,
  muscleNames,
}: {
  workload: MuscleWorkload;
  muscleNames: Record<string, string>;
}) {
  const [view, setView] = useState<"front" | "back">("front");
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-zinc-900 p-1">
        {(["front", "back"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`h-11 rounded-lg font-semibold capitalize ${view === v ? "bg-emerald-500 text-zinc-950" : "text-zinc-300"}`}
          >
            {v}
          </button>
        ))}
      </div>

      <BodyDiagram view={view} workload={workload} muscleNames={muscleNames} selected={selected} onSelect={setSelected} />

      <div className="mt-4 min-h-16 rounded-xl bg-zinc-900 p-3 text-center">
        {selected ? (
          <>
            <div className="font-semibold">{muscleNames[selected] ?? selected}</div>
            <div className="text-sm text-zinc-400 capitalize">
              {workloadBucket(workload[selected] ?? 0).replace("_", " ")} — score {(workload[selected] ?? 0).toFixed(1)}
            </div>
          </>
        ) : (
          <p className="text-sm text-zinc-400">Tap a muscle to see its recent workload.</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-center gap-x-4 gap-y-2">
        {LEGEND.map((l) => (
          <div key={l.bucket} className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className={`h-3 w-3 rounded-full ${BUCKET_LEGEND_COLOR[l.bucket]}`} />
            {l.label}
          </div>
        ))}
      </div>

      <p className="mt-4 text-center text-xs text-zinc-500">
        An estimate of recent training exposure from the last 3 weeks — how much and how recently each muscle has
        been worked, weighted by effort (RPE), primary vs. secondary involvement, and time since the workout. This is{" "}
        <strong>not</strong> a medical assessment of recovery or readiness to train.
      </p>
    </div>
  );
}
