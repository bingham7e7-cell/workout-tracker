import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { SetActivePlanButton } from "@/components/SetActivePlanButton";
import { getActivePlanId, listPlans } from "@/lib/data/queries";

export default async function PlansPage() {
  const [plans, activePlanId] = await Promise.all([listPlans(), getActivePlanId()]);
  return (
    <>
      <PageHeader
        title="Plans"
        action={
          <Link href="/plans/new" className="flex h-11 items-center rounded-xl bg-emerald-500 px-4 font-semibold text-zinc-950">
            + New
          </Link>
        }
      />
      <p className="-mt-3 mb-5 text-zinc-400">
        A plan repeats an ordered list of workouts (like Push, Pull, Legs). The home screen always shows the next one
        in your active plan.{" "}
        <Link href="/templates" className="text-emerald-400 underline">
          Manage templates
        </Link>
      </p>
      {plans.length === 0 ? (
        <p className="rounded-xl bg-zinc-900 p-4 text-zinc-400">No plans yet. Create one from your templates.</p>
      ) : (
        <ul className="space-y-2">
          {plans.map((p) => (
            <li key={p.id} className="rounded-xl bg-zinc-900 p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <Link href={`/plans/${p.id}`} className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{p.name}</div>
                  <div className="truncate text-sm text-zinc-400">{p.workouts.map((w) => w.name).join(" → ") || "No workouts"}</div>
                </Link>
                <SetActivePlanButton planId={p.id} active={p.id === activePlanId} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
