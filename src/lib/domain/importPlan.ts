/**
 * AI plan import: no AI runs inside the app. The user copies a generated
 * prompt to an AI of their choice, pastes the reply back, and this module
 * extracts/validates the JSON, matches exercise names to the user's own
 * library, and builds the payload for the transactional `import_plan` RPC.
 */
import { z } from "zod";
import { MAX_NAME_LENGTH } from "./schemas";

const name = z.string().trim().min(1).max(MAX_NAME_LENGTH);

const rawExerciseSchema = z.object({
  name,
  sets: z.number().int().min(1).max(20),
  rep_range: z
    .object({ min: z.number().int().min(1).max(100), max: z.number().int().min(1).max(100) })
    .refine((r) => r.max >= r.min, { message: "rep_range.max must be >= rep_range.min" }),
  rpe: z.number().min(1).max(10).nullable().optional(),
  primary_muscles: z.array(z.string()).optional(),
  secondary_muscles: z.array(z.string()).optional(),
});

const rawWorkoutSchema = z.object({
  name,
  exercises: z.array(rawExerciseSchema).min(1, "Each workout needs at least one exercise").max(50),
});

export const importPlanSchema = z.object({
  plan_name: name,
  workouts: z.array(rawWorkoutSchema).min(1, "A plan needs at least one workout").max(50),
});

export type RawImportPlan = z.infer<typeof importPlanSchema>;

/** Finds the first balanced `{...}` object in free text and parses it as JSON — the AI's reply often has extra prose around it. */
export function extractJson(text: string): unknown | null {
  for (let i = text.indexOf("{"); i !== -1 && i < text.length; i = text.indexOf("{", i + 1)) {
    let depth = 0;
    for (let j = i; j < text.length; j++) {
      if (text[j] === "{") depth++;
      else if (text[j] === "}") {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(text.slice(i, j + 1));
          } catch {
            break; // Not valid JSON after all — try the next '{' as a starting point.
          }
        }
      }
    }
  }
  return null;
}

export type ParseResult = { ok: true; data: RawImportPlan } | { ok: false; problems: string[] };

function describeZodIssue(issue: { path: PropertyKey[]; message: string }): string {
  const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
  return `${path}${issue.message}`;
}

export function parseImportReply(raw: string): ParseResult {
  if (!raw.trim()) return { ok: false, problems: ["Paste the AI's reply first."] };
  const extracted = extractJson(raw);
  if (extracted === null) {
    return { ok: false, problems: ["Couldn't find any JSON in that reply. Make sure you pasted the AI's full response."] };
  }
  const parsed = importPlanSchema.safeParse(extracted);
  if (!parsed.success) {
    return { ok: false, problems: parsed.error.issues.map(describeZodIssue) };
  }
  return { ok: true, data: parsed.data };
}

type PreviewExerciseBase = { key: string; name: string; sets: number; repMin: number; repMax: number; rpe: number | null };
export type PreviewExercise =
  | (PreviewExerciseBase & { kind: "matched"; exerciseId: string })
  | (PreviewExerciseBase & { kind: "new"; primaryMuscles: string[]; secondaryMuscles: string[] });
export type PreviewWorkout = { key: string; name: string; exercises: PreviewExercise[] };
export type PreviewPlan = { planName: string; workouts: PreviewWorkout[] };

/**
 * The AI doesn't always spell a muscle group exactly as given (e.g. "rear
 * delts" instead of "Rear delts") — matched case-insensitively to the
 * canonical spelling so the preview's muscle chips light up correctly and a
 * correctly-meant name doesn't get flagged as invalid. A name that still
 * doesn't match any valid muscle is left as-is (validateImportPreview flags
 * it, and the preview UI lets the user remove it).
 */
function normalizeMuscleNames(names: string[], validMuscleNames: string[]): string[] {
  const canonicalByLower = new Map(validMuscleNames.map((n) => [n.toLowerCase(), n]));
  return names.map((n) => canonicalByLower.get(n.trim().toLowerCase()) ?? n.trim());
}

/** Resolves each exercise against the user's own library by exact, case-insensitive name match. */
export function buildPreview(
  data: RawImportPlan,
  existingExercises: { id: string; name: string }[],
  validMuscleNames: string[],
): PreviewPlan {
  const byName = new Map(existingExercises.map((e) => [e.name.trim().toLowerCase(), e.id]));
  return {
    planName: data.plan_name,
    workouts: data.workouts.map((w) => ({
      key: crypto.randomUUID(),
      name: w.name,
      exercises: w.exercises.map((e) => {
        const base = {
          key: crypto.randomUUID(),
          name: e.name,
          sets: e.sets,
          repMin: e.rep_range.min,
          repMax: e.rep_range.max,
          rpe: e.rpe ?? null,
        };
        const existingId = byName.get(e.name.trim().toLowerCase());
        return existingId !== undefined
          ? { ...base, kind: "matched" as const, exerciseId: existingId }
          : {
              ...base,
              kind: "new" as const,
              primaryMuscles: normalizeMuscleNames(e.primary_muscles ?? [], validMuscleNames),
              secondaryMuscles: normalizeMuscleNames(e.secondary_muscles ?? [], validMuscleNames),
            };
      }),
    })),
  };
}

/**
 * Runs after parsing and again after every preview edit. A new exercise
 * needs at least one primary muscle, every listed muscle must be one of the
 * app's valid muscle groups, and no new exercise's name may duplicate
 * another new exercise or one the user already has (the user can swap it
 * for the existing one, or rename it).
 */
export function validateImportPreview(preview: PreviewPlan, validMuscleNames: string[], existingExerciseNames: string[]): string[] {
  const problems: string[] = [];
  const validSet = new Set(validMuscleNames.map((m) => m.toLowerCase()));
  const existingNameSet = new Set(existingExerciseNames.map((n) => n.trim().toLowerCase()));
  const seenNewNames = new Set<string>();

  for (const workout of preview.workouts) {
    for (const ex of workout.exercises) {
      if (ex.kind !== "new") continue;
      const trimmedName = ex.name.trim();
      if (!trimmedName) {
        problems.push(`An exercise in "${workout.name}" needs a name.`);
        continue;
      }
      const key = trimmedName.toLowerCase();
      if (ex.primaryMuscles.length === 0) {
        problems.push(`"${trimmedName}" needs at least one primary muscle.`);
      }
      for (const m of [...ex.primaryMuscles, ...ex.secondaryMuscles]) {
        if (!validSet.has(m.toLowerCase())) {
          problems.push(`"${trimmedName}" lists a muscle that isn't on the valid list: ${m}.`);
        }
      }
      if (existingNameSet.has(key)) {
        problems.push(`"${trimmedName}" has the same name as an exercise you already have — swap it for the existing one, or rename it.`);
      }
      if (seenNewNames.has(key)) {
        problems.push(`"${trimmedName}" is used for more than one new exercise in this import.`);
      }
      seenNewNames.add(key);
    }
  }
  return problems;
}

/** Our template_exercises schema stores one target rep count, not a range — the AI's suggested range's midpoint, rounded. */
export function repTarget(min: number, max: number): number {
  return Math.round((min + max) / 2);
}

export type ImportPayload = {
  plan_id: string;
  plan_name: string;
  workouts: {
    name: string;
    exercises: (
      | { kind: "matched"; exercise_id: string; sets: number; reps: number }
      | { kind: "new"; name: string; primary: string[]; secondary: string[]; sets: number; reps: number }
    )[];
  }[];
};

/**
 * Builds the payload for the import_plan RPC from a (validated) preview.
 * `planId` is generated on the device (like every other create in this app)
 * so a retry after a lost reply is idempotent. `muscleNameToId` maps each
 * valid muscle group's display name (lowercased), as shown in the preview UI
 * and the AI's reply, to its internal id (e.g. "rear delts" ->
 * "shoulders_rear") — the only thing exercise_muscles actually stores.
 * Validation already guarantees every New exercise's muscles are in that
 * map, so a name missing from it here is dropped rather than failing the save.
 */
export function buildImportPayload(preview: PreviewPlan, muscleNameToId: Map<string, string>, planId: string): ImportPayload {
  const toIds = (names: string[]) => names.map((n) => muscleNameToId.get(n.toLowerCase())).filter((id) => id !== undefined);
  return {
    plan_id: planId,
    plan_name: preview.planName,
    workouts: preview.workouts.map((w) => ({
      name: w.name,
      exercises: w.exercises.map((e) =>
        e.kind === "matched"
          ? { kind: "matched" as const, exercise_id: e.exerciseId, sets: e.sets, reps: repTarget(e.repMin, e.repMax) }
          : {
              kind: "new" as const,
              name: e.name.trim(),
              primary: toIds(e.primaryMuscles),
              secondary: toIds(e.secondaryMuscles),
              sets: e.sets,
              reps: repTarget(e.repMin, e.repMax),
            },
      ),
    })),
  };
}

/** The ready-made prompt copied to the clipboard for "Build a plan with AI". */
export function buildImportPrompt(exerciseNames: string[], muscleGroupNames: string[]): string {
  return `I use a strength-training app and want you to build me a workout plan for it.

Prefer exercises from this list (use the exact name) — only invent a new exercise if nothing on the list fits what you want:
${exerciseNames.map((n) => `- ${n}`).join("\n")}

Valid muscle groups (use only these, spelled exactly, for any new exercise you invent):
${muscleGroupNames.map((n) => `- ${n}`).join("\n")}

Reply with ONLY a JSON object in exactly this format (no text before or after it):

{
  "plan_name": "Push/Pull/Legs",
  "workouts": [
    {
      "name": "Push",
      "exercises": [
        { "name": "Barbell Bench Press", "sets": 4, "rep_range": { "min": 6, "max": 8 }, "rpe": 8 },
        { "name": "Cable Y-Raise", "sets": 3, "rep_range": { "min": 12, "max": 15 }, "rpe": null,
          "primary_muscles": ["Rear delts"], "secondary_muscles": ["Traps"] }
      ]
    }
  ]
}

Rules:
- "rpe" is optional: a number from 1-10, or null if you'd rather not suggest one.
- Only include "primary_muscles"/"secondary_muscles" for an exercise that is NOT on the list above, and only use names from the valid muscle group list — every new exercise needs at least one primary muscle.
- The plan is an ordered list of workouts that repeats (a rolling rotation, not tied to specific calendar days).`;
}

/** The message copied by "Copy fix request", to paste back to the AI after a failed import. */
export function buildFixRequestMessage(problems: string[]): string {
  return `That didn't quite work. Please reply again with corrected JSON in the exact same format as before, fixing these problems:\n${problems
    .map((p) => `- ${p}`)
    .join("\n")}`;
}
