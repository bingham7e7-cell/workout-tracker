"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { describeError, timeoutSignal } from "@/lib/client/errors";
import {
  buildFixRequestMessage,
  buildImportPayload,
  buildImportPrompt,
  buildPreview,
  parseImportReply,
  validateImportPreview,
  type PreviewExercise,
  type PreviewPlan,
} from "@/lib/domain/importPlan";

type ExerciseOption = { id: string; name: string };
type MuscleOption = { id: string; name: string };

function updateExercise(
  preview: PreviewPlan,
  workoutKey: string,
  exerciseKey: string,
  updater: (e: PreviewExercise) => PreviewExercise,
): PreviewPlan {
  return {
    ...preview,
    workouts: preview.workouts.map((w) =>
      w.key !== workoutKey ? w : { ...w, exercises: w.exercises.map((e) => (e.key === exerciseKey ? updater(e) : e)) },
    ),
  };
}

export function AiPlanImportScreen({
  exercises,
  promptExerciseNames,
  muscleGroups,
}: {
  /** Every exercise (archived included) — used for name matching and the duplicate-name check. */
  exercises: ExerciseOption[];
  /** Active exercises only — suggested to the AI in the copied prompt. */
  promptExerciseNames: string[];
  muscleGroups: MuscleOption[];
}) {
  const router = useRouter();
  // Generated once (not per save attempt), so retrying after a lost reply
  // reuses the same id instead of importing the plan a second time.
  const [planId] = useState(() => crypto.randomUUID());
  const [reply, setReply] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewPlan | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedFix, setCopiedFix] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const allExerciseNames = useMemo(() => exercises.map((e) => e.name), [exercises]);
  const muscleNames = useMemo(() => muscleGroups.map((m) => m.name), [muscleGroups]);
  const muscleNameToId = useMemo(() => new Map(muscleGroups.map((m) => [m.name.toLowerCase(), m.id])), [muscleGroups]);
  const prompt = useMemo(() => buildImportPrompt(promptExerciseNames, muscleNames), [promptExerciseNames, muscleNames]);

  async function copyPrompt() {
    await navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  }

  async function copyFixRequest() {
    await navigator.clipboard.writeText(buildFixRequestMessage(problems));
    setCopiedFix(true);
    setTimeout(() => setCopiedFix(false), 2000);
  }

  function tryImport() {
    setSaveError(null);
    const result = parseImportReply(reply);
    if (!result.ok) {
      setProblems(result.problems);
      setPreview(null);
      return;
    }
    const built = buildPreview(result.data, exercises, muscleNames);
    setPreview(built);
    setProblems(validateImportPreview(built, muscleNames, allExerciseNames));
  }

  function revalidate(next: PreviewPlan) {
    setPreview(next);
    setProblems(validateImportPreview(next, muscleNames, allExerciseNames));
  }

  function swapForExisting(workoutKey: string, exerciseKey: string, existing: ExerciseOption) {
    if (!preview) return;
    revalidate(
      updateExercise(preview, workoutKey, exerciseKey, (e) => ({
        kind: "matched",
        key: e.key,
        name: existing.name,
        exerciseId: existing.id,
        sets: e.sets,
        repMin: e.repMin,
        repMax: e.repMax,
        rpe: e.rpe,
      })),
    );
  }

  function toggleMuscle(workoutKey: string, exerciseKey: string, muscleName: string) {
    if (!preview) return;
    revalidate(
      updateExercise(preview, workoutKey, exerciseKey, (e) => {
        if (e.kind !== "new") return e;
        const inPrimary = e.primaryMuscles.includes(muscleName);
        const inSecondary = e.secondaryMuscles.includes(muscleName);
        // Cycle: none -> primary -> secondary -> none.
        if (!inPrimary && !inSecondary) return { ...e, primaryMuscles: [...e.primaryMuscles, muscleName] };
        if (inPrimary) {
          return { ...e, primaryMuscles: e.primaryMuscles.filter((m) => m !== muscleName), secondaryMuscles: [...e.secondaryMuscles, muscleName] };
        }
        return { ...e, secondaryMuscles: e.secondaryMuscles.filter((m) => m !== muscleName) };
      }),
    );
  }

  function renameExercise(workoutKey: string, exerciseKey: string, name: string) {
    if (!preview) return;
    revalidate(updateExercise(preview, workoutKey, exerciseKey, (e) => ({ ...e, name })));
  }

  /** Removes a muscle name the AI gave that isn't on the valid list — the only way to clear one, since it has no toggle chip of its own. */
  function removeMuscle(workoutKey: string, exerciseKey: string, muscleName: string) {
    if (!preview) return;
    revalidate(
      updateExercise(preview, workoutKey, exerciseKey, (e) =>
        e.kind !== "new"
          ? e
          : {
              ...e,
              primaryMuscles: e.primaryMuscles.filter((m) => m !== muscleName),
              secondaryMuscles: e.secondaryMuscles.filter((m) => m !== muscleName),
            },
      ),
    );
  }

  async function save() {
    if (!preview || problems.length > 0 || saving) return;
    setSaving(true);
    setSaveError(null);
    const payload = buildImportPayload(preview, muscleNameToId, planId);
    const { data, error } = await getSupabaseBrowser()
      .rpc("import_plan", { p_plan: payload })
      .abortSignal(timeoutSignal(30_000));
    setSaving(false);
    if (error) return setSaveError(describeError(error));
    router.push(`/plans/${data as string}`);
    router.refresh();
  }

  if (!preview) {
    return (
      <div className="space-y-4">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-zinc-400">
          <li>Copy the prompt below.</li>
          <li>Paste it into your favorite AI assistant.</li>
          <li>Paste the AI&apos;s reply back here.</li>
        </ol>
        <button onClick={copyPrompt} className="h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-zinc-950">
          {copiedPrompt ? "Copied!" : "Copy prompt"}
        </button>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          placeholder="Paste the AI's reply here"
          rows={8}
          className="w-full rounded-xl bg-zinc-900 p-4 outline-none ring-1 ring-zinc-800 focus:ring-emerald-500"
        />
        {problems.length > 0 && (
          <div className="rounded-lg bg-red-950 p-3 text-red-200">
            <p className="mb-1 font-semibold">That reply couldn&apos;t be used:</p>
            <ul className="list-disc space-y-1 pl-5">
              {problems.map((p, i) => (
                <li key={i}>{p}</li>
              ))}
            </ul>
            <button onClick={copyFixRequest} className="mt-3 h-11 w-full rounded-lg bg-red-900 font-semibold">
              {copiedFix ? "Copied!" : "Copy fix request"}
            </button>
          </div>
        )}
        <button
          onClick={tryImport}
          disabled={!reply.trim()}
          className="h-14 w-full rounded-xl bg-zinc-800 text-lg font-semibold text-emerald-400 disabled:opacity-50"
        >
          Preview import
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        value={preview.planName}
        onChange={(e) => setPreview({ ...preview, planName: e.target.value })}
        maxLength={100}
        className="h-14 w-full rounded-xl bg-zinc-900 px-4 text-lg font-semibold outline-none ring-1 ring-zinc-800 focus:ring-emerald-500"
      />

      {preview.workouts.map((w) => (
        <section key={w.key} className="rounded-xl bg-zinc-900 p-4">
          <h2 className="mb-2 font-semibold text-emerald-400">{w.name}</h2>
          <div className="space-y-3">
            {w.exercises.map((ex) => (
              <div key={ex.key} className="rounded-lg bg-zinc-950 p-3">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      ex.kind === "matched" ? "bg-emerald-950 text-emerald-400" : "bg-amber-950 text-amber-400"
                    }`}
                  >
                    {ex.kind === "matched" ? "Matched" : "New"}
                  </span>
                  {ex.kind === "new" ? (
                    <input
                      value={ex.name}
                      onChange={(e) => renameExercise(w.key, ex.key, e.target.value)}
                      className="min-w-0 flex-1 rounded-lg bg-zinc-800 px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate font-medium">{ex.name}</span>
                  )}
                </div>
                <div className="text-sm text-zinc-400">
                  {ex.sets} sets × {ex.repMin}
                  {ex.repMax !== ex.repMin ? `–${ex.repMax}` : ""} reps
                  {ex.rpe != null && ` @ RPE ${ex.rpe}`}
                </div>

                {ex.kind === "new" && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs text-zinc-500">
                      Tap a muscle: once for <span className="text-emerald-400">primary</span>, twice for{" "}
                      <span className="text-sky-400">secondary</span>. Or swap for an existing exercise:
                    </p>
                    <select
                      defaultValue=""
                      onChange={(e) => {
                        const existing = exercises.find((x) => x.id === e.target.value);
                        if (existing) swapForExisting(w.key, ex.key, existing);
                      }}
                      className="mb-2 h-10 w-full rounded-lg bg-zinc-800 px-2 text-sm outline-none"
                    >
                      <option value="" disabled>
                        Swap for an existing exercise…
                      </option>
                      {exercises.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </select>
                    <div className="flex flex-wrap gap-1.5">
                      {muscleGroups.map((m) => {
                        const role = ex.primaryMuscles.includes(m.name)
                          ? "primary"
                          : ex.secondaryMuscles.includes(m.name)
                            ? "secondary"
                            : null;
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggleMuscle(w.key, ex.key, m.name)}
                            className={`h-9 rounded-full px-3 text-xs ${
                              role === "primary"
                                ? "bg-emerald-500 text-zinc-950"
                                : role === "secondary"
                                  ? "bg-sky-500 text-zinc-950"
                                  : "bg-zinc-800 text-zinc-300"
                            }`}
                          >
                            {m.name}
                          </button>
                        );
                      })}
                      {[...ex.primaryMuscles, ...ex.secondaryMuscles]
                        .filter((name) => !muscleGroups.some((m) => m.name === name))
                        .map((name) => (
                          <button
                            key={name}
                            type="button"
                            onClick={() => removeMuscle(w.key, ex.key, name)}
                            className="h-9 rounded-full bg-red-950 px-3 text-xs text-red-300"
                          >
                            {name} ✕
                          </button>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}

      {problems.length > 0 && (
        <div className="rounded-lg bg-red-950 p-3 text-red-200">
          <p className="mb-1 font-semibold">Fix these before saving:</p>
          <ul className="list-disc space-y-1 pl-5">
            {problems.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}
      {saveError && <p className="rounded-lg bg-red-950 p-3 text-red-200">{saveError}</p>}

      <button
        onClick={save}
        disabled={problems.length > 0 || saving}
        className="h-14 w-full rounded-xl bg-emerald-500 text-lg font-semibold text-zinc-950 disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save plan"}
      </button>
      <button onClick={() => setPreview(null)} className="h-12 w-full text-zinc-400">
        Back to paste
      </button>
    </div>
  );
}
