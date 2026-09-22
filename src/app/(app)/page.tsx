import Link from "next/link";
import { ActiveWorkoutBanner } from "@/components/ActiveWorkoutBanner";
import { PageHeader } from "@/components/PageHeader";
import { StartWorkoutButton } from "@/components/StartWorkoutButton";
import { getWeightUnit, listTemplates, listWorkouts } from "@/lib/data/queries";
import { LocalTime } from "@/components/LocalTime";

export default async function HomePage() {
  const [unit, templates, recent] = await Promise.all([getWeightUnit(), listTemplates(), listWorkouts(3)]);

  return (
    <>
      <PageHeader title="Workouts" />
      <ActiveWorkoutBanner />

      <StartWorkoutButton
        unit={unit}
        className="mb-6 h-14 w-full rounded-2xl bg-zinc-800 text-lg font-semibold active:bg-zinc-700"
      >
        + Start empty workout
      </StartWorkoutButton>

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
                  <div className="text-sm text-zinc-400"><LocalTime iso={w.startedAt} /></div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
