import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { getTimeZoneMode, listWorkouts } from "@/lib/data/queries";
import { LocalTime } from "@/components/LocalTime";
import { formatDuration } from "@/lib/format";

export default async function HistoryPage() {
  const [workouts, tz] = await Promise.all([listWorkouts(), getTimeZoneMode()]);
  return (
    <>
      <PageHeader title="History" />
      {workouts.length === 0 ? (
        <p className="rounded-xl bg-zinc-900 p-4 text-zinc-400">No workouts yet. Finished workouts show up here.</p>
      ) : (
        <ul className="space-y-2">
          {workouts.map((w) => (
            <li key={w.id}>
              <Link href={`/history/${w.id}`} className="block rounded-xl bg-zinc-900 p-4 active:bg-zinc-800">
                <div className="font-semibold">{w.name}</div>
                <div className="text-sm text-zinc-400">
                  <LocalTime iso={w.startedAt} tz={tz} /> · {formatDuration(w.startedAt, w.finishedAt)} · {w.exerciseCount} exercise
                  {w.exerciseCount === 1 ? "" : "s"}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
