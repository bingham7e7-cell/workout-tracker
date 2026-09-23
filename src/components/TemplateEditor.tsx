"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { describeError, timeoutSignal } from "@/lib/client/errors";
import { firstIssue, templatePayloadSchema } from "@/lib/domain/schemas";
import type { TemplateSummary } from "@/lib/data/queries";

type Row = { key: string; exerciseId: string; name: string; sets: string; reps: string };

const toInt = (s: string) => (s.trim() === "" ? null : Number(s));

export function TemplateEditor({ initial }: { initial: (TemplateSummary & { notes: string | null }) | null }) {
  const router = useRouter();
  // New templates get their id up front, so retrying a save can't create a duplicate.
  const [templateId] = useState(() => initial?.id ?? crypto.randomUUID());
  const [name, setName] = useState(initial?.name ?? "");
  const [rows, setRows] = useState<Row[]>(
    initial?.exercises.map((e) => ({
      key: crypto.randomUUID(),
      exerciseId: e.exerciseId,
      name: e.name,
      sets: e.targetSets?.toString() ?? "",
      reps: e.targetReps?.toString() ?? "",
    })) ?? [],
  );
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update(key: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

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
    const parsed = templatePayloadSchema.safeParse({
      id: templateId,
      name,
      notes: initial?.notes ?? null,
      exercises: rows.map((r) => ({ exercise_id: r.exerciseId, target_sets: toInt(r.sets), target_reps: toInt(r.reps) })),
    });
    if (!parsed.success) {
      setError(
        parsed.error.issues[0]?.path.includes("target_sets")
          ? "Sets must be a whole number from 1 to 20"
          : parsed.error.issues[0]?.path.includes("target_reps")
            ? "Reps must be a whole number from 1 to 100"
            : firstIssue(parsed.error),
      );
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await getSupabaseBrowser()
      .rpc("save_template", { p_template: parsed.data })
      .abortSignal(timeoutSignal());
    setBusy(false);
    if (error) return setError(describeError(error));
    router.push("/templates");
    router.refresh();
  }

  async function duplicate() {
    if (!initial || busy) return;
    const parsed = templatePayloadSchema.safeParse({
      id: crypto.randomUUID(),
      name: `${initial.name} copy`.slice(0, 100),
      notes: initial.notes,
      exercises: rows.map((r) => ({ exercise_id: r.exerciseId, target_sets: toInt(r.sets), target_reps: toInt(r.reps) })),
    });
    if (!parsed.success) return setError(firstIssue(parsed.error));
    setBusy(true);
    setError(null);
    const { error } = await getSupabaseBrowser()
      .rpc("save_template", { p_template: parsed.data })
      .abortSignal(timeoutSignal());
    setBusy(false);
    if (error) return setError(describeError(error));
    router.push(`/templates/${parsed.data.id}`);
    router.refresh();
  }

  async function remove() {
    if (!initial || busy) return;
    if (!window.confirm(`Delete the template "${initial.name}"?\n\nPast workouts are not affected.`)) return;
    setBusy(true);
    const { error } = await getSupabaseBrowser()
      .from("templates")
      .delete()
      .eq("id", initial.id)
      .abortSignal(timeoutSignal());
    setBusy(false);
    if (error) return setError(describeError(error));
    router.push("/templates");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <input
        placeholder="Template name (e.g. Push Day)"
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
        className="h-14 w-full rounded-xl bg-zinc-900 px-4 text-lg outline-none ring-1 ring-zinc-800 focus:ring-emerald-500"
      />

      <ul className="space-y-2">
        {rows.map((r, i) => (
          <li key={r.key} className="rounded-xl bg-zinc-900 p-3">
            <div className="mb-2 flex items-center gap-1">
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
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="–"
                value={r.sets}
                onChange={(e) => update(r.key, { sets: e.target.value.replace(/\D/g, "") })}
                className="h-11 w-16 rounded-lg bg-zinc-800 text-center text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500"
              />
              sets ×
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="–"
                value={r.reps}
                onChange={(e) => update(r.key, { reps: e.target.value.replace(/\D/g, "") })}
                className="h-11 w-16 rounded-lg bg-zinc-800 text-center text-zinc-100 outline-none focus:ring-1 focus:ring-emerald-500"
              />
              reps
            </div>
          </li>
        ))}
      </ul>

      <button
        onClick={() => setPicking(true)}
        className="h-14 w-full rounded-xl border border-dashed border-zinc-700 font-medium text-emerald-400"
      >
        + Add exercise
      </button>

      {error && <p className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}

      <button
        onClick={save}
        disabled={busy}
        className="h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-zinc-950 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save template"}
      </button>
      {initial && (
        <div className="flex gap-2">
          <button onClick={duplicate} disabled={busy} className="h-12 flex-1 rounded-xl bg-zinc-800 font-medium disabled:opacity-50">
            Duplicate
          </button>
          <button onClick={remove} disabled={busy} className="h-12 flex-1 text-red-400 disabled:opacity-50">
            Delete template
          </button>
        </div>
      )}

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(e) => {
            setRows((rs) => [...rs, { key: crypto.randomUUID(), ...e, sets: "3", reps: "" }]);
            setPicking(false);
          }}
        />
      )}
    </div>
  );
}
