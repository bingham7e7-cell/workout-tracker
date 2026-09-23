import Link from "next/link";
import { ActiveWorkoutBanner } from "@/components/ActiveWorkoutBanner";
import { PageHeader } from "@/components/PageHeader";
import { StartWorkoutButton } from "@/components/StartWorkoutButton";
import { SkipPlanButton } from "@/components/SkipPlanButton";
import { MuscleDiagram } from "@/components/MuscleDiagram";
import { WeekStrip } from "@/components/WeekStrip";
import { LocalTime } from "@/components/LocalTime";
import {
  getActivePlanNext,
  getRecentSetsForWorkload,
  getTimeZoneMode,
  getWeightUnit,
  listMuscleGroups,
  listRecentWorkoutDates,
  listTemplates,
  listWorkouts,
} from "@/lib/data/queries";
import { muscleWorkload } from "@/lib/domain/workload";

export default async function HomePage() {
  const [unit, tz, templates, recent, sets, muscleGroups, activePlanNext, recentDates] = await Promise.all([
    getWeightUnit(),
    getTimeZoneMode(),
    listTemplates(),
    listWorkouts(3),
    getRecentSetsForWorkload(),
    listMuscleGroups(),
    getActivePlanNext(),
    listRecentWorkoutDates(),
  ]);
  const workload = muscleWorkload(sets);
  const muscleNames = Object.fromEntries(muscleGroups.map((m) => [m.id, m.name]));

  return (
    <>
      <PageHeader title="Workouts" />
      <ActiveWorkoutBanner />

      <MuscleDiagram workload={workload} muscleNames={muscleNames} figureWidth={120} />
      <WeekStrip finishedIsoDates={recentDates} tz={tz} />

      {activePlanNext ? (
        <section className="mb-8 rounded-2xl bg-zinc-900 p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-sm text-zinc-400">
              Next up in {activePlanNext.planName} ({activePlanNext.position + 1}/{activePlanNext.totalWorkouts})
            </span>
            <SkipPlanButton />
          </div>
          <div className="mb-4 text-xl font-bold">{activePlanNext.workout.name}</div>
          <StartWorkoutButton
            unit={unit}
            template={activePlanNext.workout}
            className="h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-zinc-950 active:bg-emerald-400"
          >
            Start
          </StartWorkoutButton>
          <StartWorkoutButton unit={unit} className="mt-2 flex h-11 w-full items-center justify-center text-sm text-zinc-400">
            or start an empty workout
          </StartWorkoutButton>
        </section>
      ) : (
        <StartWorkoutButton
          unit={unit}
          className="mb-8 h-14 w-full rounded-2xl bg-emerald-500 text-lg font-semibold text-zinc-950 active:bg-emerald-400"
        >
          Start workout
        </StartWorkoutButton>
      )}

      <section className="mb-8">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Start from a template</h2>
          <Link href="/templates/new" className="inline-flex min-h-11 items-center px-3 text-emerald-400">
            New
          </Link>
        </div>
        {templates.length === 0 ? (
          <p className="rounded-xl bg-zinc-900 p-4 text-zinc-400">
            No templates yet.{" "}
            <Link href="/templates/new" className="text-emerald-400 underline">
              Create one
            </Link>{" "}
            to start workouts faster.
          </p>
        ) : (
          <ul className="space-y-2">
            {templates.map((t) => (
              <li key={t.id} className="flex items-center gap-3 rounded-xl bg-zinc-900 p-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{t.name}</div>
                  <div className="truncate text-sm text-zinc-400">
                    {t.exercises.map((e) => e.name).join(", ") || "No exercises"}
                  </div>
                </div>
                <StartWorkoutButton
                  unit={unit}
                  template={t}
                  className="h-12 shrink-0 rounded-xl bg-emerald-500 px-5 font-semibold text-zinc-950 active:bg-emerald-400"
                >
                  Start
                </StartWorkoutButton>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recent.length > 0 && (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Recent</h2>
            <Link href="/history" className="inline-flex min-h-11 items-center px-3 text-emerald-400">
              All
            </Link>
          </div>
          <ul className="space-y-2">
            {recent.map((w) => (
              <li key={w.id}>
                <Link href={`/history/${w.id}`} className="block rounded-xl bg-zinc-900 p-3 active:bg-zinc-800">
                  <div className="font-semibold">{w.name}</div>
                  <div className="text-sm text-zinc-400">
                    <LocalTime iso={w.startedAt} tz={tz} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
