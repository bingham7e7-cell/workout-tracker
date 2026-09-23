"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatDate, type TimeZoneMode } from "@/lib/format";
import type { WeightUnit } from "@/lib/domain/units";

export type ChartPoint = {
  startedAt: string;
  /** Already converted to the user's display unit. */
  topWeight: number | null;
  topWeightReps: number | null;
  volume: number;
  estimated1RM: number | null;
};

type Metric = "estimated1RM" | "topWeight" | "volume";

const METRICS: { key: Metric; label: string }[] = [
  { key: "estimated1RM", label: "Est. 1RM" },
  { key: "topWeight", label: "Top set" },
  { key: "volume", label: "Volume" },
];

function CustomTooltip({
  active,
  payload,
  unit,
  metric,
  tz,
}: {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
  unit: WeightUnit;
  metric: Metric;
  tz: TimeZoneMode;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg bg-zinc-800 px-3 py-2 text-sm shadow-lg">
      <div className="text-zinc-400">{formatDate(p.startedAt, tz)}</div>
      {metric === "estimated1RM" && p.estimated1RM != null && (
        <div className="font-semibold text-emerald-400">
          {Math.round(p.estimated1RM * 10) / 10} {unit}
        </div>
      )}
      {metric === "topWeight" && p.topWeight != null && (
        <div className="font-semibold text-emerald-400">
          {p.topWeight} {unit} × {p.topWeightReps}
        </div>
      )}
      {metric === "volume" && (
        <div className="font-semibold text-emerald-400">
          {Math.round(p.volume).toLocaleString()} {unit}
        </div>
      )}
    </div>
  );
}

/** Progress over time for one exercise: estimated 1RM, top-set weight, or session volume. */
export function ProgressChart({ points, unit, tz }: { points: ChartPoint[]; unit: WeightUnit; tz: TimeZoneMode }) {
  const [metric, setMetric] = useState<Metric>("estimated1RM");

  if (points.length < 2) {
    return (
      <p className="rounded-xl bg-zinc-900 p-4 text-sm text-zinc-400">
        Log this exercise in at least two workouts to see a progress chart.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-zinc-900 p-1">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`h-10 rounded-lg text-sm font-semibold ${metric === m.key ? "bg-emerald-500 text-zinc-950" : "text-zinc-300"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <div className="h-56 w-full rounded-xl bg-zinc-900 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
            <CartesianGrid stroke="var(--color-zinc-800)" vertical={false} />
            <XAxis
              dataKey="startedAt"
              tickFormatter={(v: string) => formatDate(v, tz).replace(/,.*/, "")}
              stroke="var(--color-zinc-500)"
              fontSize={11}
              minTickGap={24}
            />
            <YAxis stroke="var(--color-zinc-500)" fontSize={11} width={40} domain={["auto", "auto"]} />
            <Tooltip content={<CustomTooltip unit={unit} metric={metric} tz={tz} />} />
            <Line
              type="monotone"
              dataKey={metric}
              stroke="var(--color-emerald-400)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--color-emerald-400)" }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
