import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteWorkoutButton } from "@/components/DeleteWorkoutButton";
import { PageHeader } from "@/components/PageHeader";
import { getTimeZoneMode, getWeightUnit, getWorkout } from "@/lib/data/queries";
import { formatWeight } from "@/lib/domain/units";
import { LocalTime } from "@/components/LocalTime";
import { formatDuration } from "@/lib/format";

export default async function WorkoutDetailPage({ params }: PageProps<"/history/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [workout, unit, tz] = await Promise.all([getWorkout(id), getWeightUnit(), getTimeZoneMode()]);
  if (!workout) notFound();

  return (
    <>
      <PageHeader title={workout.name} />
      <p className="-mt-3 mb-5 text-zinc-400">
        <LocalTime iso={workout.startedAt} show="dateTime" tz={tz} /> ·{" "}
        {formatDuration(workout.startedAt, workout.finishedAt)}
      </p>

      <div className="space-y-4">
        {workout.exercises.map((ex) => {
          let working = 0;
          return (
            <section key={ex.id} className="rounded-xl bg-zinc-900 p-4">
              <h2 className="mb-2 font-semibold text-emerald-400">{ex.name}</h2>
              <ol className="space-y-1">
                {ex.sets.map((s) => (
                  <li key={s.id} className="flex items-baseline gap-3">
                    <span className={`w-6 text-center text-sm font-bold ${s.isWarmup ? "text-amber-400" : "text-zinc-500"}`}>
                      {s.isWarmup ? "W" : ++working}
                    </span>
                    <span className="font-medium">
                      {formatWeight(s.weightKg, unit)} {unit} × {s.reps}
                    </span>
                    {s.rpe != null && <span className="text-sm text-sky-400">@{s.rpe}</span>}
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>

      <div className="mt-6 flex gap-2">
        <Link href="/history" className="flex h-12 flex-1 items-center justify-center rounded-xl bg-zinc-800 font-medium">
          Back to history
        </Link>
        <Link
          href={`/history/${workout.id}/edit`}
          className="flex h-12 flex-1 items-center justify-center rounded-xl bg-zinc-800 font-medium text-emerald-400"
        >
          Edit
        </Link>
      </div>
      <DeleteWorkoutButton id={workout.id} name={workout.name} />
    </>
  );
}
