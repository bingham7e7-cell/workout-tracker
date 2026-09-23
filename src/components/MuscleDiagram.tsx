"use client";

import { useState } from "react";
import { MuscleMap } from "@musclemap/react";
import type { MuscleGroup, MuscleMapValues } from "@musclemap/core";
import { workloadBucket, type MuscleWorkload } from "@/lib/domain/workload";

/**
 * The only file in the app that imports @musclemap/react (MIT-licensed —
 * see Settings > Credits for attribution). Everywhere else renders muscle
 * workload through this component, keeping the library swappable.
 */

// A workload score of 10 "effective recent sets" is already deep into the
// "very high" bucket (see lib/domain/workload.ts), so it maps to the top of
// MuscleMap's 0-100 score scale rather than trying to define some
// theoretical maximum a lifter could ever reach.
const WORKLOAD_AT_MAX_SCORE = 10;

function toLibraryScore(workload: number): number {
  return Math.max(0, Math.min(100, Math.round((workload / WORKLOAD_AT_MAX_SCORE) * 100)));
}

// muscle_groups.id values ARE MuscleMap's own group names, lowercased (see
// the muscle-groups migration), so converting between the two is a plain
// case change, not a lookup table that could drift out of sync.
function toMuscleGroup(id: string): MuscleGroup {
  return id.toUpperCase() as MuscleGroup;
}
function toMuscleId(group: MuscleGroup): string {
  return group.toLowerCase();
}

export type MuscleDiagramProps = {
  workload: MuscleWorkload;
  muscleNames: Record<string, string>;
  /** Width of each (front/back) figure in px. Defaults to a size that fits both side by side at iPhone widths. */
  figureWidth?: number;
  /** Hide the tap-to-see-details panel — used for small, non-interactive previews (e.g. the home screen). */
  hideDetails?: boolean;
};

export function MuscleDiagram({ workload, muscleNames, figureWidth = 150, hideDetails = false }: MuscleDiagramProps) {
  const [selected, setSelected] = useState<{ id: string; score: number } | null>(null);

  const values: MuscleMapValues = {};
  for (const [id, score] of Object.entries(workload)) {
    values[toMuscleGroup(id)] = { score: toLibraryScore(score) };
  }
  const labels = Object.fromEntries(
    Object.entries(muscleNames).map(([id, name]) => [toMuscleGroup(id), name]),
  ) as Partial<Record<MuscleGroup, string>>;

  return (
    <div>
      <MuscleMap
        values={values}
        view="BOTH"
        colorModel="LOAD"
        labels={labels}
        figureWidth={figureWidth}
        legendMinLabel="Untrained"
        legendMaxLabel="Very high"
        showLegend={!hideDetails}
        tooltipFields={[]}
        onSelectMuscle={
          hideDetails
            ? undefined
            : ({ group }) => {
                const id = toMuscleId(group);
                setSelected((prev) => (prev?.id === id ? null : { id, score: workload[id] ?? 0 }));
              }
        }
      />

      {!hideDetails && (
        <div className="mt-3 min-h-16 rounded-xl bg-zinc-900 p-3 text-center">
          {selected ? (
            <>
              <div className="font-semibold">{muscleNames[selected.id] ?? selected.id}</div>
              <div className="text-sm capitalize text-zinc-400">
                {workloadBucket(selected.score).replace("_", " ")} — recent workload {selected.score.toFixed(1)}
              </div>
            </>
          ) : (
            <p className="text-sm text-zinc-400">Tap a muscle to see its recent workload.</p>
          )}
        </div>
      )}
    </div>
  );
}
