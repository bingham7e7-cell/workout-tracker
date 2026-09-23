"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ExercisePicker } from "@/components/ExercisePicker";
import { SetRow } from "@/components/workout/SetRow";
import {
  addExercise,
  addSet,
  countSets,
  editDraftFromWorkout,
  moveExercise,
  removeExercise,
  removeSet,
  renameDraft,
  toSavePayload,
  toggleSetDone,
  updateSet,
  type EditableWorkout,
  type WorkoutDraft,
} from "@/lib/domain/draft";
import { describeError, isSignedOutError, timeoutSignal } from "@/lib/client/errors";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { WeightUnit } from "@/lib/domain/units";

/** Edits an already-saved workout: same set-logging UI as the active workout, backed by `update_workout`. */
export function EditWorkoutScreen({ workout, unit }: { workout: EditableWorkout; unit: WeightUnit }) {
  const router = useRouter();
  const [draft, setDraft] = useState<WorkoutDraft>(() => editDraftFromWorkout(workout, unit));
  const [picking, setPicking] = useState(false);
  const [setErrors, setSetErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  function commit(change: (d: WorkoutDraft) => WorkoutDraft) {
    if (savingRef.current) return;
    setDraft(change);
  }

  function clearSetError(setKey: string) {
    setSetErrors((errs) => {
      if (!errs[setKey]) return errs;
      const next = { ...errs };
      delete next[setKey];
      return next;
    });
  }

  function toggleDone(exKey: string, setKey: string) {
    if (savingRef.current) return;
    const result = toggleSetDone(draft, exKey, setKey);
    if (result.error) {
      setSetErrors((errs) => ({ ...errs, [setKey]: result.error! }));
      return;
    }
    clearSetError(setKey);
    setDraft(result.draft);
  }

  async function save() {
    if (savingRef.current) return;
    setError(null);
    setSaveFailed(false);

    const { logged } = countSets(draft);
    if (logged === 0) {
      setError("Log at least one set (tap ✓), or delete the workout instead.");
      return;
    }

    const built = toSavePayload(draft, new Date(workout.finishedAt), workout.notes);
    if ("error" in built) {
      setError(built.error);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const { error } = await getSupabaseBrowser()
        .rpc("update_workout", { p_workout: built.payload })
        .abortSignal(timeoutSignal(30_000));
      if (error) throw error;
      router.replace(`/history/${workout.id}`);
      router.refresh();
    } catch (e) {
      setError(describeError(e));
      setSaveFailed(true);
      setSignedOut(isSignedOutError(e));
      savingRef.current = false;
      setSaving(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const { logged } = countSets(draft);

  return (
    <div className="pb-8">
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-2 border-b border-zinc-900 bg-zinc-950/95 px-4 pt-safe backdrop-blur">
        <Link
          href={`/history/${workout.id}`}
          aria-label="Cancel editing"
          className="-ml-2 flex h-12 w-10 shrink-0 items-center justify-center text-2xl text-zinc-400"
        >
          ‹
        </Link>
        <div className="min-w-0 flex-1 py-2">
          <input
            aria-label="Workout name"
            value={draft.name}
            maxLength={100}
            onChange={(e) => commit((d) => renameDraft(d, e.target.value))}
            className="w-full truncate bg-transparent text-xl font-bold outline-none"
          />
          <div className="text-sm text-zinc-400">{logged} set{logged === 1 ? "" : "s"} logged</div>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="h-12 shrink-0 rounded-xl bg-emerald-500 px-5 text-lg font-bold text-zinc-950 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </header>

      {error && (
        <div className="mt-3 rounded-lg bg-red-950 p-3 text-red-200">
          {error}
          {!saving && saveFailed && signedOut && (
            <Link href="/login" className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-red-900 font-semibold">
              Sign in again
            </Link>
          )}
          {!saving && saveFailed && !signedOut && (
            <button onClick={save} className="mt-2 block h-11 w-full rounded-lg bg-red-900 font-semibold">
              Try saving again
            </button>
          )}
        </div>
      )}

      <div className="mt-4 space-y-6">
        {draft.exercises.map((ex, exIndex) => {
          let working = 0;
          return (
            <section key={ex.key}>
              <div className="mb-2 flex items-center gap-1">
                <h2 className="min-w-0 flex-1 truncate text-lg font-semibold text-emerald-400">{ex.name}</h2>
                <button
                  aria-label="Move exercise up"
                  disabled={exIndex === 0}
                  onClick={() => commit((d) => moveExercise(d, ex.key, -1))}
                  className="h-11 w-11 rounded-lg text-zinc-400 disabled:opacity-30"
                >
                  ↑
                </button>
                <button
                  aria-label="Move exercise down"
                  disabled={exIndex === draft.exercises.length - 1}
                  onClick={() => commit((d) => moveExercise(d, ex.key, 1))}
                  className="h-11 w-11 rounded-lg text-zinc-400 disabled:opacity-30"
                >
                  ↓
                </button>
                <button
                  aria-label="Remove exercise"
                  onClick={() => {
                    if (window.confirm(`Remove ${ex.name} and its logged sets from this workout?`)) {
                      commit((d) => removeExercise(d, ex.key));
                    }
                  }}
                  className="h-11 w-11 rounded-lg text-red-400"
                >
                  ✕
                </button>
              </div>

              <div className="mb-1 grid grid-cols-[2.75rem_1fr_1fr_2.75rem_3.5rem] gap-2 px-1 text-center text-xs uppercase tracking-wide text-zinc-500">
                <span>Set</span>
                <span>{draft.unit}</span>
                <span>Reps</span>
                <span>RPE</span>
                <span />
              </div>

              <div className="space-y-1">
                {ex.sets.map((s) => {
                  const label = s.isWarmup ? "W" : String(++working);
                  return (
                    <SetRow
                      key={s.key}
                      set={s}
                      label={label}
                      unit={draft.unit}
                      error={setErrors[s.key]}
                      onChange={(patch) => {
                        clearSetError(s.key);
                        commit((d) => updateSet(d, ex.key, s.key, patch));
                      }}
                      onToggleDone={() => toggleDone(ex.key, s.key)}
                      onRemove={() => commit((d) => removeSet(d, ex.key, s.key))}
                    />
                  );
                })}
              </div>

              <button
                onClick={() => commit((d) => addSet(d, ex.key))}
                className="mt-2 h-12 w-full rounded-xl bg-zinc-900 font-medium text-zinc-300 active:bg-zinc-800"
              >
                + Add set
              </button>
            </section>
          );
        })}
      </div>

      <button
        onClick={() => setPicking(true)}
        className="mt-6 h-14 w-full rounded-xl bg-zinc-800 text-lg font-semibold text-emerald-400 active:bg-zinc-700"
      >
        + Add exercise
      </button>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(e) => {
            commit((d) => addExercise(d, e));
            setPicking(false);
            requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }));
          }}
        />
      )}
    </div>
  );
}
