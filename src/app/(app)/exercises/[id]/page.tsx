import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { LocalTime } from "@/components/LocalTime";
import { ProgressChart, type ChartPoint } from "@/components/analytics/ProgressChart";
import { getExerciseHistory, getTimeZoneMode, getWeightUnit } from "@/lib/data/queries";
import { progressPoints } from "@/lib/domain/analytics";
import { formatWeight, fromKg } from "@/lib/domain/units";

export default async function ExerciseHistoryPage({ params }: PageProps<"/exercises/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [history, unit, tz] = await Promise.all([getExerciseHistory(id), getWeightUnit(), getTimeZoneMode()]);
  if (!history) notFound();

  const points: ChartPoint[] = progressPoints(
    history.entries.map((e) => ({ workoutId: e.workoutId, startedAt: e.startedAt, sets: e.sets })),
  ).map((p) => ({
    startedAt: p.startedAt,
    topWeight: p.topWeightKg == null ? null : fromKg(p.topWeightKg, unit),
    topWeightReps: p.topWeightReps,
    volume: fromKg(p.volumeKg, unit),
    estimated1RM: p.estimated1RMKg == null ? null : fromKg(p.estimated1RMKg, unit),
  }));

  const { records } = history;

  return (
    <>
      <PageHeader title={history.name} />
      {history.archived && (
        <p className="-mt-3 mb-4 text-sm text-amber-400">
          Archived — no longer in your active library, but past history is kept.
        </p>
      )}

      {records.heaviestWeight || records.bestEstimated1RM || records.bestSessionVolume ? (
        <div className="mb-6 grid grid-cols-3 gap-2">
          <PrCard
            label="Heaviest set"
            value={records.heaviestWeight ? `${formatWeight(records.heaviestWeight.weightKg, unit)} ${unit}` : "—"}
            detail={records.heaviestWeight ? `× ${records.heaviestWeight.reps}` : undefined}
          />
          <PrCard
            label="Best est. 1RM"
            value={records.bestEstimated1RM ? `${formatWeight(records.bestEstimated1RM.estimated1RMKg, unit)} ${unit}` : "—"}
            detail={
              records.bestEstimated1RM
                ? `from ${formatWeight(records.bestEstimated1RM.weightKg, unit)}×${records.bestEstimated1RM.reps}`
                : undefined
            }
          />
          <PrCard
            label="Best session volume"
            value={records.bestSessionVolume ? `${Math.round(fromKg(records.bestSessionVolume.volumeKg, unit)).toLocaleString()} ${unit}` : "—"}
          />
        </div>
      ) : (
        <p className="mb-6 rounded-xl bg-zinc-900 p-4 text-zinc-400">No working sets logged for this exercise yet.</p>
      )}

      <h2 className="mb-2 text-lg font-semibold">Progress</h2>
      <div className="mb-8">
        <ProgressChart points={points} unit={unit} tz={tz} />
      </div>

      <h2 className="mb-2 text-lg font-semibold">History</h2>
      {history.entries.length === 0 ? (
        <p className="rounded-xl bg-zinc-900 p-4 text-zinc-400">No sessions yet.</p>
      ) : (
        <ul className="space-y-2">
          {history.entries.map((entry) => {
            let working = 0;
            return (
              <li key={entry.workoutId}>
                <Link href={`/history/${entry.workoutId}`} className="block rounded-xl bg-zinc-900 p-3 active:bg-zinc-800">
                  <div className="mb-1 text-sm text-zinc-400">
                    <LocalTime iso={entry.startedAt} tz={tz} />
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {entry.sets.map((s, i) => (
                      <span key={i} className={s.isWarmup ? "text-sm text-zinc-500" : "text-sm font-medium"}>
                        {s.isWarmup ? "W " : `${++working} `}
                        {formatWeight(s.weightKg, unit)}
                        {unit}×{s.reps}
                        {s.rpe != null && <span className="text-sky-400"> @{s.rpe}</span>}
                      </span>
                    ))}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function PrCard({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl bg-zinc-900 p-3 text-center">
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 text-lg font-bold text-emerald-400">{value}</div>
      {detail && <div className="text-xs text-zinc-500">{detail}</div>}
    </div>
  );
}
