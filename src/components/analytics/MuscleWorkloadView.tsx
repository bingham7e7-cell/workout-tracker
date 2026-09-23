"use client";

import { MuscleDiagram } from "@/components/MuscleDiagram";
import type { MuscleWorkload } from "@/lib/domain/workload";

export function MuscleWorkloadView({
  workload,
  muscleNames,
}: {
  workload: MuscleWorkload;
  muscleNames: Record<string, string>;
}) {
  return (
    <div>
      <MuscleDiagram workload={workload} muscleNames={muscleNames} figureWidth={160} />

      <p className="mt-4 text-center text-xs text-zinc-500">
        An estimate of recent training exposure from the last 3 weeks — how much and how recently each muscle has
        been worked, weighted by effort (RPE), primary vs. secondary involvement, and time since the workout. This is{" "}
        <strong>not</strong> a medical assessment of recovery or readiness to train.
      </p>
    </div>
  );
}
