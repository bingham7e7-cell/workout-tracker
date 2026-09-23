/**
 * The in-progress ("draft") workout. It lives on the device until Finish.
 * Every function here is pure: it takes a draft and returns a new one, which
 * keeps the logic easy to test and safe to persist after every change.
 */
import { MAX_REPS, MAX_WEIGHT_KG, workoutPayloadSchema, firstIssue, type WorkoutPayload } from "./schemas";
import { formatWeight, toKg, type WeightUnit } from "./units";

export type DraftSet = {
  key: string;
  /** As typed, in the draft's unit. Kept as text so partial input like "22." survives. */
  weight: string;
  reps: string;
  rpe: number | null;
  isWarmup: boolean;
  /** Logged (✓ tapped). Only logged sets are saved. */
  done: boolean;
};

/** A set as logged the last time this exercise was performed (any workout). */
export type PreviousSet = { weightKg: number; reps: number; rpe: number | null; isWarmup: boolean };

export type DraftExercise = {
  key: string;
  exerciseId: string;
  name: string;
  sets: DraftSet[];
  /** undefined = not fetched yet, null = fetched, no history, array = last time's sets. */
  previous?: PreviousSet[] | null;
};

export type WorkoutDraft = {
  version: 1;
  /** Generated at start; becomes the database id and prevents duplicate saves. */
  id: string;
  name: string;
  templateId: string | null;
  unit: WeightUnit;
  startedAt: string;
  exercises: DraftExercise[];
  /**
   * Set the moment "Finish" is tapped, before the save even reaches the network.
   * A draft with this set is done being logged and is just waiting to reach the
   * database — offline or on a flaky connection, it stays on the phone with this
   * flag until a save succeeds, so closing and reopening the app doesn't lose the
   * "already finished, just not saved yet" state.
   */
  finishedAt?: string;
};

export type TemplateExerciseSeed = {
  exerciseId: string;
  name: string;
  targetSets: number | null;
  targetReps: number | null;
};

const newKey = () => crypto.randomUUID();

function emptySet(weight = "", reps = ""): DraftSet {
  return { key: newKey(), weight, reps, rpe: null, isWarmup: false, done: false };
}

export function createDraft(opts: {
  name: string;
  templateId: string | null;
  unit: WeightUnit;
  exercises: TemplateExerciseSeed[];
  now?: Date;
}): WorkoutDraft {
  return {
    version: 1,
    id: crypto.randomUUID(),
    name: opts.name,
    templateId: opts.templateId,
    unit: opts.unit,
    startedAt: (opts.now ?? new Date()).toISOString(),
    exercises: opts.exercises.map((e) => ({
      key: newKey(),
      exerciseId: e.exerciseId,
      name: e.name,
      sets: Array.from({ length: e.targetSets ?? 1 }, () =>
        emptySet("", e.targetReps != null ? String(e.targetReps) : ""),
      ),
    })),
  };
}

function mapExercise(draft: WorkoutDraft, exKey: string, fn: (ex: DraftExercise) => DraftExercise): WorkoutDraft {
  return { ...draft, exercises: draft.exercises.map((ex) => (ex.key === exKey ? fn(ex) : ex)) };
}

export function renameDraft(draft: WorkoutDraft, name: string): WorkoutDraft {
  return { ...draft, name };
}

/** Marks the draft as finished (waiting to save), fixing the finish time so retries don't drift it. */
export function markFinishing(draft: WorkoutDraft, finishedAt: string): WorkoutDraft {
  return { ...draft, finishedAt };
}

/** Returns to editing after a finish attempt (e.g. so the owner can fix something before retrying). */
export function cancelFinishing(draft: WorkoutDraft): WorkoutDraft {
  if (!draft.finishedAt) return draft;
  const next = { ...draft };
  delete next.finishedAt;
  return next;
}

export function addExercise(draft: WorkoutDraft, exercise: { exerciseId: string; name: string }): WorkoutDraft {
  return {
    ...draft,
    exercises: [...draft.exercises, { key: newKey(), ...exercise, sets: [emptySet()] }],
  };
}

export function removeExercise(draft: WorkoutDraft, exKey: string): WorkoutDraft {
  return { ...draft, exercises: draft.exercises.filter((ex) => ex.key !== exKey) };
}

export function moveExercise(draft: WorkoutDraft, exKey: string, direction: -1 | 1): WorkoutDraft {
  const i = draft.exercises.findIndex((ex) => ex.key === exKey);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= draft.exercises.length) return draft;
  const exercises = [...draft.exercises];
  [exercises[i], exercises[j]] = [exercises[j], exercises[i]];
  return { ...draft, exercises };
}

/** Adds a set pre-filled with the previous set's weight and reps. */
export function addSet(draft: WorkoutDraft, exKey: string): WorkoutDraft {
  return mapExercise(draft, exKey, (ex) => {
    const last = ex.sets[ex.sets.length - 1];
    return { ...ex, sets: [...ex.sets, emptySet(last?.weight ?? "", last?.reps ?? "")] };
  });
}

export function updateSet(
  draft: WorkoutDraft,
  exKey: string,
  setKey: string,
  patch: Partial<Omit<DraftSet, "key">>,
): WorkoutDraft {
  return mapExercise(draft, exKey, (ex) => ({
    ...ex,
    sets: ex.sets.map((s) => (s.key === setKey ? { ...s, ...patch } : s)),
  }));
}

export function removeSet(draft: WorkoutDraft, exKey: string, setKey: string): WorkoutDraft {
  return mapExercise(draft, exKey, (ex) => ({ ...ex, sets: ex.sets.filter((s) => s.key !== setKey) }));
}

/** Records what was fetched for "last time you did this exercise" (`null` = no prior history). */
export function setPreviousSets(draft: WorkoutDraft, exKey: string, previous: PreviousSet[] | null): WorkoutDraft {
  return mapExercise(draft, exKey, (ex) => ({ ...ex, previous }));
}

/** "135x5 (W), 225x5, 225x5 @8.5" — a one-line summary of the last session's sets. */
export function summarizePreviousSets(previous: PreviousSet[], unit: WeightUnit): string {
  return previous
    .map((s) => {
      const base = `${formatWeight(s.weightKg, unit)}×${s.reps}`;
      const rpe = s.rpe != null ? ` @${s.rpe}` : "";
      return s.isWarmup ? `${base} (W)${rpe}` : `${base}${rpe}`;
    })
    .join(", ");
}

/** Parses a typed number; accepts a comma as the decimal separator. */
export function parseNumber(text: string): number | null {
  const cleaned = text.trim().replace(",", ".");
  if (cleaned === "" || !/^\d*\.?\d*$/.test(cleaned) || cleaned === ".") return null;
  return Number(cleaned);
}

export type ParsedSet = { weight: number; reps: number };

/** Validates a set's typed values. Returns an error message or the numbers. */
export function parseSet(set: Pick<DraftSet, "weight" | "reps">, unit: WeightUnit): ParsedSet | { error: string } {
  const weight = parseNumber(set.weight);
  const reps = parseNumber(set.reps);
  if (weight === null) return { error: "Enter a weight (0 for bodyweight)" };
  if (toKg(weight, unit) > MAX_WEIGHT_KG) return { error: "Weight is too high" };
  if (reps === null || !Number.isInteger(reps)) return { error: "Enter whole reps" };
  if (reps < 1) return { error: "Reps must be at least 1" };
  if (reps > MAX_REPS) return { error: "Too many reps" };
  return { weight, reps };
}

/**
 * Marks a set as logged (or un-logs it). When logging, later un-logged sets in
 * the same exercise inherit its weight/reps, so a typical
 * "same weight, same reps" workout is: type once, then tap ✓ ✓ ✓.
 */
export function toggleSetDone(
  draft: WorkoutDraft,
  exKey: string,
  setKey: string,
): { draft: WorkoutDraft; error?: string } {
  const ex = draft.exercises.find((e) => e.key === exKey);
  const idx = ex?.sets.findIndex((s) => s.key === setKey) ?? -1;
  if (!ex || idx < 0) return { draft };
  const set = ex.sets[idx];

  if (set.done) return { draft: updateSet(draft, exKey, setKey, { done: false }) };

  const parsed = parseSet(set, draft.unit);
  if ("error" in parsed) return { draft, error: parsed.error };

  const sets = ex.sets.map((s, i) => {
    if (i === idx) return { ...s, done: true };
    // Carry values forward to later un-logged sets of the same kind
    // (a warm-up never overwrites the working sets that follow it).
    if (i > idx && !s.done && s.isWarmup === set.isWarmup) {
      return { ...s, weight: set.weight, reps: set.reps };
    }
    return s;
  });
  return { draft: mapExercise(draft, exKey, (e) => ({ ...e, sets })) };
}

export function countSets(draft: WorkoutDraft): { logged: number; unlogged: number } {
  let logged = 0;
  let unlogged = 0;
  for (const ex of draft.exercises) {
    for (const s of ex.sets) {
      if (s.done) logged++;
      else unlogged++;
    }
  }
  return { logged, unlogged };
}

/**
 * Builds the database payload: only logged sets, weights in kg, exercises with
 * no logged sets dropped. Validated with the shared zod schema.
 */
export function toSavePayload(
  draft: WorkoutDraft,
  finishedAt: Date = new Date(),
  notes: string | null = null,
): { payload: WorkoutPayload } | { error: string } {
  const exercises = [];
  for (const ex of draft.exercises) {
    const sets = [];
    for (const s of ex.sets.filter((x) => x.done)) {
      const parsed = parseSet(s, draft.unit);
      if ("error" in parsed) return { error: `${ex.name}: ${parsed.error}` };
      sets.push({
        weight_kg: toKg(parsed.weight, draft.unit),
        reps: parsed.reps,
        rpe: s.rpe,
        is_warmup: s.isWarmup,
      });
    }
    if (sets.length > 0) exercises.push({ exercise_id: ex.exerciseId, notes: null, sets });
  }

  // Guard against a phone clock that jumped backwards mid-workout.
  const started = new Date(draft.startedAt);
  const finished = finishedAt < started ? started : finishedAt;

  const result = workoutPayloadSchema.safeParse({
    id: draft.id,
    name: draft.name.trim() || "Workout",
    template_id: draft.templateId,
    started_at: started.toISOString(),
    finished_at: finished.toISOString(),
    notes,
    exercises,
  });
  if (!result.success) return { error: firstIssue(result.error) };
  return { payload: result.data };
}

/** A saved workout, in the shape needed to build an edit draft (structurally compatible with `WorkoutDetail`). */
export type EditableWorkout = {
  id: string;
  name: string;
  startedAt: string;
  finishedAt: string;
  notes: string | null;
  exercises: {
    exerciseId: string;
    name: string;
    sets: { weightKg: number; reps: number; rpe: number | null; isWarmup: boolean }[];
  }[];
};

/**
 * Turns an already-saved workout back into a draft for editing. Every set
 * starts "logged" (✓), since it was already recorded; unchecking one removes
 * it when saved, same as the active workout screen.
 */
export function editDraftFromWorkout(workout: EditableWorkout, unit: WeightUnit): WorkoutDraft {
  return {
    version: 1,
    id: workout.id,
    name: workout.name,
    templateId: null,
    unit,
    startedAt: workout.startedAt,
    exercises: workout.exercises.map((ex) => ({
      key: newKey(),
      exerciseId: ex.exerciseId,
      name: ex.name,
      sets: ex.sets.map((s) => ({
        key: newKey(),
        weight: formatWeight(s.weightKg, unit),
        reps: String(s.reps),
        rpe: s.rpe,
        isWarmup: s.isWarmup,
        done: true,
      })),
    })),
  };
}
