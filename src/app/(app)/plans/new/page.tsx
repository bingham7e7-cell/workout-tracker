import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { CopyStarterPlanButton } from "@/components/CopyStarterPlanButton";
import { listStarterPlans } from "@/lib/data/queries";

export default async function NewPlanChooserPage() {
  const starterPlans = await listStarterPlans();
  return (
    <>
      <PageHeader title="New plan" />

      <section className="mb-8">
        <h2 className="mb-2 text-lg font-semibold">Start from a template</h2>
        <p className="mb-3 text-sm text-zinc-400">
          Copies into your own plan and workout templates — edit or delete it however you like afterward.
        </p>
        <ul className="space-y-2">
          {starterPlans.map((p) => (
            <li key={p.id} className="rounded-xl bg-zinc-900 p-4">
              <div className="mb-1 font-semibold">{p.name}</div>
              <div className="mb-3 text-sm text-zinc-400">{p.workoutNames.join(" → ")}</div>
              <CopyStarterPlanButton starterPlanId={p.id} />
            </li>
          ))}
        </ul>
      </section>

      <Link
        href="/plans/new/ai"
        className="mb-3 flex h-14 w-full items-center justify-center rounded-xl border border-dashed border-zinc-700 font-medium text-emerald-400"
      >
        Build a plan with AI
      </Link>
      <Link
        href="/plans/new/build"
        className="flex h-14 w-full items-center justify-center rounded-xl border border-dashed border-zinc-700 font-medium text-emerald-400"
      >
        Build my own
      </Link>
    </>
  );
}
