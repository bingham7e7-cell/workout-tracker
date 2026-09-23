import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { getWeightUnit, listExercisePRs } from "@/lib/data/queries";
import { formatWeight } from "@/lib/domain/units";

export default async function AnalyticsPage() {
  const [prs, unit] = await Promise.all([listExercisePRs(), getWeightUnit()]);

  return (
    <>
      <PageHeader
        title="Personal records"
        action={
          <Link href="/exercises" className="inline-flex min-h-11 items-center px-3 text-emerald-400">
            All exercises
          </Link>
        }
      />
      <p className="-mt-3 mb-5 text-zinc-400">
        Your best set (by estimated 1RM) for every exercise you&apos;ve logged. Warm-ups don&apos;t count.
      </p>
      {prs.length === 0 ? (
        <p className="rounded-xl bg-zinc-900 p-4 text-zinc-400">
          Finish a workout with at least one logged set to see records here.
        </p>
      ) : (
        <ul className="space-y-2">
          {prs.map((pr) => (
            <li key={pr.exerciseId}>
              <Link href={`/exercises/${pr.exerciseId}`} className="flex items-center justify-between rounded-xl bg-zinc-900 p-4 active:bg-zinc-800">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{pr.name}</div>
                  {pr.records.heaviestWeight && (
                    <div className="text-sm text-zinc-400">
                      heaviest set: {formatWeight(pr.records.heaviestWeight.weightKg, unit)}
                      {unit} × {pr.records.heaviestWeight.reps}
                    </div>
                  )}
                </div>
                {pr.records.bestEstimated1RM ? (
                  <div className="shrink-0 text-right">
                    <div className="text-lg font-bold text-emerald-400">
                      {formatWeight(pr.records.bestEstimated1RM.estimated1RMKg, unit)} {unit}
                    </div>
                    <div className="text-xs uppercase tracking-wide text-zinc-500">est. 1RM</div>
                  </div>
                ) : (
                  <div className="shrink-0 text-xs text-zinc-500">
                    Est. 1RM needs
                    <br />a set of 1–12 reps
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
