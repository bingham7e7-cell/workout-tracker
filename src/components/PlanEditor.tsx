"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { describeError, timeoutSignal } from "@/lib/client/errors";
import { firstIssue, planPayloadSchema } from "@/lib/domain/schemas";
import type { PlanSummary, TemplateSummary } from "@/lib/data/queries";

type Row = { key: string; templateId: string; name: string };

export function PlanEditor({
  initial,
  availableTemplates,
}: {
  initial: PlanSummary | null;
  availableTemplates: TemplateSummary[];
}) {
  const router = useRouter();
  // New plans get their id up front, so retrying a save can't create a duplicate.
  const [planId] = useState(() => initial?.id ?? crypto.randomUUID());
  const [name, setName] = useState(initial?.name ?? "");
  const [rows, setRows] = useState<Row[]>(
    initial?.workouts.map((w) => ({ key: crypto.randomUUID(), templateId: w.templateId, name: w.name })) ?? [],
  );
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function move(index: number, dir: -1 | 1) {
    setRows((rs) => {
      const j = index + dir;
      if (j < 0 || j >= rs.length) return rs;
      const next = [...rs];
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  async function save() {
    if (busy) return;
    const parsed = planPayloadSchema.safeParse({ id: planId, name, template_ids: rows.map((r) => r.templateId) });
    if (!parsed.success) return setError(firstIssue(parsed.error));
    setBusy(true);
    setError(null);
    const { error } = await getSupabaseBrowser().rpc("save_plan", { p_plan: parsed.data }).abortSignal(timeoutSignal());
    setBusy(false);
    if (error) return setError(describeError(error));
    router.push("/plans");
    router.refresh();
  }

  async function remove() {
    if (!initial || busy) return;
    if (!window.confirm(`Delete the plan "${initial.name}"? Its workout templates are not affected.`)) return;
    setBusy(true);
    const { error } = await getSupabaseBrowser().from("plans").delete().eq("id", initial.id).abortSignal(timeoutSignal());
    setBusy(false);
    if (error) return setError(describeError(error));
    router.push("/plans");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <input
        placeholder="Plan name (e.g. Push/Pull/Legs)"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
        className="h-14 w-full rounded-xl bg-zinc-900 px-4 text-lg outline-none ring-1 ring-zinc-800 focus:ring-emerald-500"
      />

      {rows.length === 0 ? (
        <p className="rounded-xl bg-zinc-900 p-4 text-zinc-400">
          Add workouts in the order they should repeat — the plan loops back to the first one after the last.
        </p>
      ) : (
        <ol className="space-y-2">
          {rows.map((r, i) => (
            <li key={r.key} className="flex items-center gap-1 rounded-xl bg-zinc-900 p-3">
              <span className="w-6 shrink-0 text-center text-sm text-zinc-500">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
              <button aria-label="Move up" onClick={() => move(i, -1)} disabled={i === 0} className="h-11 w-11 rounded-lg text-zinc-400 disabled:opacity-30">
                ↑
              </button>
              <button aria-label="Move down" onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="h-11 w-11 rounded-lg text-zinc-400 disabled:opacity-30">
                ↓
              </button>
              <button aria-label="Remove" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="h-11 w-11 rounded-lg text-red-400">
                ✕
              </button>
            </li>
          ))}
        </ol>
      )}

      <button
        onClick={() => setPicking(true)}
        className="h-14 w-full rounded-xl border border-dashed border-zinc-700 font-medium text-emerald-400"
      >
        + Add workout
      </button>

      {error && <p className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}

      <button
        onClick={save}
        disabled={busy}
        className="h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-zinc-950 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save plan"}
      </button>
      {initial && (
        <button onClick={remove} disabled={busy} className="h-12 w-full text-red-400 disabled:opacity-50">
          Delete plan
        </button>
      )}

      {picking && (
        <div className="fixed inset-0 z-40 flex flex-col bg-zinc-950 pt-safe">
          <div className="mx-auto flex w-full max-w-md items-center justify-between px-4 py-3">
            <h2 className="text-lg font-semibold">Add a workout</h2>
            <button onClick={() => setPicking(false)} className="h-12 px-3 text-emerald-400">
              Cancel
            </button>
          </div>
          <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 pb-safe">
            {availableTemplates.length === 0 ? (
              <p className="py-6 text-center text-zinc-400">
                No templates yet — create one first, then come back to build a plan from it.
              </p>
            ) : (
              <ul className="divide-y divide-zinc-900">
                {availableTemplates.map((t) => (
                  <li key={t.id}>
                    <button
                      onClick={() => {
                        setRows((rs) => [...rs, { key: crypto.randomUUID(), templateId: t.id, name: t.name }]);
                        setPicking(false);
                      }}
                      className="flex min-h-14 w-full items-center justify-between py-3 text-left active:bg-zinc-900"
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className="text-sm text-zinc-500">{t.exercises.length} exercise{t.exercises.length === 1 ? "" : "s"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
