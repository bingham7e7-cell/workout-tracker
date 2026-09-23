"use client";

import { useId } from "react";
import { BACK_MUSCLES, FRONT_MUSCLES, SILHOUETTE, type MuscleShape, type Shape } from "./muscleRegions";
import { workloadBucket, type MuscleWorkload, type WorkloadBucket } from "@/lib/domain/workload";

const BUCKET_COLOR: Record<WorkloadBucket, string> = {
  untrained: "#27272a", // zinc-800: not trained recently
  light: "#0ea5e9", // sky-500
  moderate: "#10b981", // emerald-500
  high: "#f59e0b", // amber-500
  very_high: "#ef4444", // red-500
};

export const LEGEND: { bucket: WorkloadBucket; label: string }[] = [
  { bucket: "untrained", label: "Untrained" },
  { bucket: "light", label: "Light" },
  { bucket: "moderate", label: "Moderate" },
  { bucket: "high", label: "High" },
  { bucket: "very_high", label: "Very high" },
];

type ShapeStyle = { fill: string; fillOpacity?: number; stroke: string; strokeWidth: number };

function ShapeEl({ shape, ...style }: { shape: Shape } & ShapeStyle) {
  if (shape.type === "ellipse") {
    const transform = shape.rotate ? `rotate(${shape.rotate} ${shape.cx} ${shape.cy})` : undefined;
    return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} transform={transform} {...style} />;
  }
  if (shape.type === "rect") {
    return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} {...style} />;
  }
  return <polygon points={shape.points} {...style} />;
}

type Props = {
  view: "front" | "back";
  workload: MuscleWorkload;
  muscleNames: Record<string, string>;
  selected: string | null;
  onSelect: (muscleGroupId: string | null) => void;
};

/** One original, hand-drawn (geometric, not traced) front or back body diagram. */
export function BodyDiagram({ view, workload, muscleNames, selected, onSelect }: Props) {
  const titleId = useId();
  const muscles = view === "front" ? FRONT_MUSCLES : BACK_MUSCLES;

  return (
    <svg viewBox="0 0 240 520" role="img" aria-labelledby={titleId} className="mx-auto h-auto w-full max-w-[220px]">
      <title id={titleId}>{view === "front" ? "Front of body" : "Back of body"} muscle workload diagram</title>
      {SILHOUETTE.map((shape, i) => (
        <ShapeEl key={i} shape={shape} fill="#18181b" stroke="#3f3f46" strokeWidth={1} />
      ))}
      {muscles.map((muscle: MuscleShape) => {
        const score = workload[muscle.muscleGroupId] ?? 0;
        const color = BUCKET_COLOR[workloadBucket(score)];
        const isSelected = selected === muscle.muscleGroupId;
        return (
          <g
            key={muscle.muscleGroupId}
            onClick={() => onSelect(isSelected ? null : muscle.muscleGroupId)}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={`${muscleNames[muscle.muscleGroupId] ?? muscle.muscleGroupId}: ${workloadBucket(score).replace("_", " ")}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSelect(isSelected ? null : muscle.muscleGroupId);
              }
            }}
          >
            {muscle.shapes.map((shape, i) => (
              <ShapeEl
                key={i}
                shape={shape}
                fill={color}
                fillOpacity={0.92}
                stroke={isSelected ? "#f4f4f5" : "#09090b"}
                strokeWidth={isSelected ? 2.5 : 1}
              />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
