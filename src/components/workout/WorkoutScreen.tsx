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
  moveExercise,
  removeExercise,
  removeSet,
  renameDraft,
  toSavePayload,
  toggleSetDone,
  updateSet,
  type WorkoutDraft,
} from "@/lib/domain/draft";
import { clearDraft, loadDraft, saveDraft, useActiveDraft } from "@/lib/client/draftStorage";
import { describeError, timeoutSignal } from "@/lib/client/errors";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { formatTime } from "@/lib/format";

export function WorkoutScreen() {
  const router = useRouter();
  const { draft, ready } = useActiveDraft();
  const [picking, setPicking] = useState(false);
  const [setErrors, setSetErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // A ref (not state) so a lightning-fast double tap can't slip through.
  const savingRef = useRef(false);

  /** Apply a change to the stored workout; the screen re-renders from storage. */
  function commit(change: (d: WorkoutDraft) => WorkoutDraft) {
    const current = loadDraft();
    if (!current || savingRef.current) return;
    if (!saveDraft(change(current))) setStorageWarning(true);
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
    const current = loadDraft();
    if (!current || savingRef.current) return;
    const result = toggleSetDone(current, exKey, setKey);
    if (result.error) {
      setSetErrors((errs) => ({ ...errs, [setKey]: result.error! }));
      return;
    }
    clearSetError(setKey);
    if (!saveDraft(result.draft)) setStorageWarning(true);
  }

  async function finish() {
    if (savingRef.current) return;
    const current = loadDraft();
    if (!current) return;
    setError(null);
    setSaveFailed(false);

    const { logged, unlogged } = countSets(current);
    if (logged === 0) {
      setError("Log at least one set (tap ✓) before finishing.");
      return;
    }
    const message =
      unlogged > 0
        ? `Finish and save this workout?\n\n${unlogged} set${unlogged === 1 ? "" : "s"} without a ✓ will be discarded.`
        : "Finish and save this workout?";
    if (!window.confirm(message)) return;

    const built = toSavePayload(current);
    if ("error" in built) {
      setError(built.error);
      return;
    }

    savingRef.current = true;
    setSaving(true);
    try {
      const { error } = await getSupabaseBrowser()
        .rpc("save_workout", { p_workout: built.payload })
        .abortSignal(timeoutSignal(30_000));
      if (error) throw error;
      // Only now — after the database confirmed — remove it from the phone.
      setSaved(true);
      clearDraft();
      router.replace(`/history/${built.payload.id}`);
      router.refresh();
    } catch (e) {
      setError(`${describeError(e)} Your workout is still safe on this phone.`);
      setSaveFailed(true);
      savingRef.current = false;
      setSaving(false);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function discard() {
    if (!window.confirm("Discard this workout? Everything you logged in it will be lost.")) return;
    clearDraft();
    router.replace("/");
  }

  if (!ready) return null;
  if (saved) return <p className="mt-24 text-center text-lg">Saved ✓</p>;
  if (!draft) {
    return (
      <div className="mt-24 space-y-4 text-center">
        <p className="text-lg">No workout in progress.</p>
        <Link href="/" className="inline-flex h-12 items-center rounded-xl bg-emerald-500 px-6 font-semibold text-zinc-950">
          Go to start
        </Link>
      </div>
    );
  }

  const { logged } = countSets(draft);

  return (
    <div className="pb-8">
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-2 border-b border-zinc-900 bg-zinc-950/95 px-4 pt-safe backdrop-blur">
        <div className="min-w-0 flex-1 py-2">
          <input
            aria-label="Workout name"
            value={draft.name}
            maxLength={100}
            onChange={(e) => commit((d) => renameDraft(d, e.target.value))}
            className="w-full truncate bg-transparent text-xl font-bold outline-none"
          />
          <div className="text-sm text-zinc-400">
            Started {formatTime(draft.startedAt)} · {logged} set{logged === 1 ? "" : "s"} logged
          </div>
        </div>
        <button
          onClick={finish}
          disabled={saving}
          className="h-12 shrink-0 rounded-xl bg-emerald-500 px-5 text-lg font-bold text-zinc-950 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Finish"}
        </button>
      </header>

      {storageWarning && (
        <p className="mt-3 rounded-lg bg-amber-950 p-3 text-sm text-amber-200">
          This phone isn&apos;t letting the app store data (private browsing or storage full). Keep this screen open
          until you finish.
        </p>
      )}
      {error && (
        <div className="mt-3 rounded-lg bg-red-950 p-3 text-red-200">
          {error}
          {!saving && saveFailed && (
            <button onClick={finish} className="mt-2 block h-11 w-full rounded-lg bg-red-900 font-semibold">
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
                    const hasLogged = ex.sets.some((s) => s.done);
                    if (!hasLogged || window.confirm(`Remove ${ex.name} and its logged sets?`)) {
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

      <button onClick={discard} className="mt-8 h-12 w-full text-red-400">
        Discard workout
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
