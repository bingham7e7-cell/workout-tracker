import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { listTemplates } from "@/lib/data/queries";

export default async function TemplatesPage() {
  const templates = await listTemplates();
  return (
    <>
      <PageHeader
        title="Templates"
        action={
          <Link href="/templates/new" className="flex h-11 items-center rounded-xl bg-emerald-500 px-4 font-semibold text-zinc-950">
            + New
          </Link>
        }
      />
      <Link href="/plans" className="-mt-3 mb-5 inline-flex min-h-11 items-center text-emerald-400 underline">
        Plans (rotate templates automatically) →
      </Link>
      {templates.length === 0 ? (
        <p className="rounded-xl bg-zinc-900 p-4 text-zinc-400">
          A template is a reusable workout plan, like “Push Day”. Create one to start workouts with one tap.
        </p>
      ) : (
        <ul className="space-y-2">
          {templates.map((t) => (
            <li key={t.id}>
              <Link href={`/templates/${t.id}`} className="block rounded-xl bg-zinc-900 p-4 active:bg-zinc-800">
                <div className="font-semibold">{t.name}</div>
                <div className="text-sm text-zinc-400">
                  {t.exercises.length} exercise{t.exercises.length === 1 ? "" : "s"}
                  {t.exercises.length > 0 && ` · ${t.exercises.map((e) => e.name).join(", ")}`}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
