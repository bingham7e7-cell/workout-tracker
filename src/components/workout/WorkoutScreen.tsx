"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  setPreviousSets,
  summarizePreviousSets,
  toSavePayload,
  toggleSetDone,
  updateSet,
  type PreviousSet,
  type WorkoutDraft,
} from "@/lib/domain/draft";
import { clearDraft, loadDraft, saveDraft, useActiveDraft } from "@/lib/client/draftStorage";
import { describeError, isSignedOutError, timeoutSignal } from "@/lib/client/errors";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { formatTime } from "@/lib/format";

export function WorkoutScreen() {
  const router = useRouter();
  const { draft, ready } = useActiveDraft();
  const [picking, setPicking] = useState(false);
  const [setErrors, setSetErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saveFailed, setSaveFailed] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // A ref (not state) so a lightning-fast double tap can't slip through.
  const savingRef = useRef(false);
  // Exercise ids we've already asked the server for "last time" values (successfully, or exhausted retries).
  const fetchedPreviousRef = useRef(new Set<string>());
  // Retry attempts made per exercise id, so a flaky network doesn't retry forever.
  const previousAttemptsRef = useRef(new Map<string, number>());
  const [previousRetryTick, setPreviousRetryTick] = useState(0);

  /** Apply a change to the stored workout; the screen re-renders from storage. */
  function commit(change: (d: WorkoutDraft) => WorkoutDraft) {
    const current = loadDraft();
    if (!current || savingRef.current) return;
    if (!saveDraft(change(current))) setStorageWarning(true);
  }

  // Fetch "last time" values for any exercise in the draft we haven't asked about yet.
  useEffect(() => {
    if (!draft) return;
    const missing = draft.exercises
      .map((ex) => ex.exerciseId)
      .filter((id) => !fetchedPreviousRef.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => fetchedPreviousRef.current.add(id));

    getSupabaseBrowser()
      .rpc("previous_exercise_sets", { p_exercise_ids: missing })
      .abortSignal(timeoutSignal())
      .then(({ data, error }) => {
        if (error || !data) {
          // Not critical: the workout still works without it. Retry a few times (a
          // gym has flaky signal) before giving up quietly for the rest of the session.
          const stillRetrying = missing.filter((id) => {
            const attempts = (previousAttemptsRef.current.get(id) ?? 0) + 1;
            previousAttemptsRef.current.set(id, attempts);
            // Under the retry cap: un-mark so the next attempt re-fetches it.
            // At the cap: leave it marked "fetched" so it's left alone from now on.
            if (attempts < 3) fetchedPreviousRef.current.delete(id);
            return attempts < 3;
          });
          if (stillRetrying.length > 0) {
            setTimeout(() => setPreviousRetryTick((t) => t + 1), 5000);
          }
          return;
        }
        type RawSet = { weight_kg: number | string; reps: number; rpe: number | string | null; is_warmup: boolean };
        const byExercise = new Map<string, PreviousSet[]>(
          (data as { exercise_id: string; sets: RawSet[] }[]).map((r) => [
            r.exercise_id,
            r.sets.map((s) => ({
              weightKg: Number(s.weight_kg),
              reps: s.reps,
              rpe: s.rpe == null ? null : Number(s.rpe),
              isWarmup: s.is_warmup,
            })),
          ]),
        );
        const current = loadDraft();
        if (!current) return;
        let next = current;
        for (const ex of current.exercises) {
          if (!missing.includes(ex.exerciseId)) continue;
          next = setPreviousSets(next, ex.key, byExercise.get(ex.exerciseId) ?? null);
        }
        saveDraft(next);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft?.exercises.map((e) => e.exerciseId).join(","), previousRetryTick]);

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
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .rpc("save_workout", { p_workout: built.payload })
        .abortSignal(timeoutSignal(30_000));
      if (error) throw error;
      if ((data as { duplicate?: boolean } | null)?.duplicate) {
        // An earlier attempt already reached the database (its reply was lost).
        // Apply this latest version on top, so edits made since then aren't dropped.
        const { error: updateError } = await supabase
          .rpc("update_workout", { p_workout: built.payload })
          .abortSignal(timeoutSignal(30_000));
        if (updateError) throw updateError;
      }
      // Only now — after the database confirmed — remove it from the phone.
      setSaved(true);
      clearDraft();
      router.replace(`/history/${built.payload.id}`);
      router.refresh();
    } catch (e) {
      setError(`${describeError(e)} Your workout is still safe on this phone.`);
      setSaveFailed(true);
      setSignedOut(isSignedOutError(e));
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
        <Link
          href="/"
          aria-label="Home (your workout stays in progress)"
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
          {!saving && saveFailed && signedOut && (
            <Link href="/login" className="mt-2 flex h-11 w-full items-center justify-center rounded-lg bg-red-900 font-semibold">
              Sign in again
            </Link>
          )}
          {!saving && saveFailed && !signedOut && (
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

              {ex.previous && ex.previous.length > 0 && (
                <p className="mb-2 truncate px-1 text-sm text-zinc-400">
                  Last time: {summarizePreviousSets(ex.previous, draft.unit)}
                </p>
              )}

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
