import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { listExercises } from "@/lib/data/queries";

export default async function ExercisesPage() {
  const exercises = await listExercises();
  const active = exercises.filter((e) => !e.archived);
  const archived = exercises.filter((e) => e.archived);

  return (
    <>
      <PageHeader title="Exercises" />
      <p className="-mt-3 mb-5 text-zinc-400">Tap an exercise to see its history, personal records, and progress.</p>
      {exercises.length === 0 ? (
        <p className="rounded-xl bg-zinc-900 p-4 text-zinc-400">No exercises yet.</p>
      ) : (
        <>
          <ul className="space-y-2">
            {active.map((e) => (
              <li key={e.id}>
                <Link href={`/exercises/${e.id}`} className="flex min-h-14 items-center justify-between rounded-xl bg-zinc-900 px-4 py-3 active:bg-zinc-800">
                  <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
                  <span className="flex shrink-0 items-center gap-2">
                    {e.addedByImport && (
                      <span className="rounded-full bg-amber-950 px-2 py-0.5 text-xs font-semibold text-amber-400">Added by import</span>
                    )}
                    {e.equipment && <span className="text-sm text-zinc-500">{e.equipment}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {archived.length > 0 && (
            <>
              <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-zinc-500">Archived</h2>
              <ul className="space-y-2">
                {archived.map((e) => (
                  <li key={e.id}>
                    <Link
                      href={`/exercises/${e.id}`}
                      className="flex min-h-14 items-center justify-between rounded-xl bg-zinc-900/50 px-4 py-3 text-zinc-400 active:bg-zinc-800"
                    >
                      <span className="font-medium">{e.name}</span>
                      {e.equipment && <span className="text-sm text-zinc-500">{e.equipment}</span>}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}
