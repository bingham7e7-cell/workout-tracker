"use client";

/**
 * CSV/JSON export of all training data. Runs entirely in the browser (fetches
 * as the signed-in user via the same publishable-key client used everywhere
 * else, so RLS still applies — this can only ever export the caller's own
 * data), then triggers a file download. No server involved.
 */
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { timeoutSignal } from "@/lib/client/errors";

type RawWorkout = {
  id: string;
  name: string;
  started_at: string;
  finished_at: string;
  notes: string | null;
  workout_exercises: {
    exercise_id: string;
    exercise_name: string;
    position: number;
    notes: string | null;
    workout_sets: { position: number; weight_kg: number | string; reps: number; rpe: number | string | null; is_warmup: boolean }[];
  }[];
};

type RawTemplate = {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
  template_exercises: { position: number; target_sets: number | null; target_reps: number | null; exercises: { name: string } | null }[];
};

type RawExercise = {
  id: string;
  name: string;
  equipment: string | null;
  archived_at: string | null;
  created_at: string;
  exercise_muscles: { muscle_group_id: string; role: string }[];
};

export type ExportData = {
  exportedAt: string;
  weightUnit: "kg";
  workouts: {
    id: string;
    name: string;
    startedAt: string;
    finishedAt: string;
    notes: string | null;
    exercises: {
      exerciseId: string;
      name: string;
      notes: string | null;
      sets: { setNumber: number; weightKg: number; reps: number; rpe: number | null; isWarmup: boolean }[];
    }[];
  }[];
  templates: {
    id: string;
    name: string;
    notes: string | null;
    exercises: { name: string; targetSets: number | null; targetReps: number | null }[];
  }[];
  exercises: {
    id: string;
    name: string;
    equipment: string | null;
    archived: boolean;
    primaryMuscles: string[];
    secondaryMuscles: string[];
  }[];
};

/** Fetches everything needed for an export, as the signed-in user. */
export async function buildExportData(): Promise<ExportData> {
  const supabase = getSupabaseBrowser();
  const signal = timeoutSignal(30_000);

  const [{ data: workouts, error: workoutsError }, { data: templates, error: templatesError }, { data: exercises, error: exercisesError }] =
    await Promise.all([
      supabase
        .from("workouts")
        .select(
          "id, name, started_at, finished_at, notes, workout_exercises(exercise_id, exercise_name, position, notes, workout_sets(position, weight_kg, reps, rpe, is_warmup))",
        )
        .order("started_at", { ascending: true })
        .abortSignal(signal),
      supabase
        .from("templates")
        .select("id, name, notes, created_at, template_exercises(position, target_sets, target_reps, exercises(name))")
        .order("name")
        .abortSignal(signal),
      supabase
        .from("exercises")
        .select("id, name, equipment, archived_at, created_at, exercise_muscles(muscle_group_id, role)")
        .order("name")
        .abortSignal(signal),
    ]);
  if (workoutsError) throw workoutsError;
  if (templatesError) throw templatesError;
  if (exercisesError) throw exercisesError;

  return {
    exportedAt: new Date().toISOString(),
    weightUnit: "kg",
    workouts: (workouts as unknown as RawWorkout[]).map((w) => ({
      id: w.id,
      name: w.name,
      startedAt: w.started_at,
      finishedAt: w.finished_at,
      notes: w.notes,
      exercises: [...w.workout_exercises]
        .sort((a, b) => a.position - b.position)
        .map((we) => ({
          exerciseId: we.exercise_id,
          name: we.exercise_name,
          notes: we.notes,
          sets: [...we.workout_sets]
            .sort((a, b) => a.position - b.position)
            .map((s, i) => ({
              setNumber: i + 1,
              weightKg: Number(s.weight_kg),
              reps: s.reps,
              rpe: s.rpe == null ? null : Number(s.rpe),
              isWarmup: s.is_warmup,
            })),
        })),
    })),
    templates: (templates as unknown as RawTemplate[]).map((t) => ({
      id: t.id,
      name: t.name,
      notes: t.notes,
      exercises: [...t.template_exercises]
        .sort((a, b) => a.position - b.position)
        .map((te) => ({ name: te.exercises?.name ?? "Unknown exercise", targetSets: te.target_sets, targetReps: te.target_reps })),
    })),
    exercises: (exercises as RawExercise[]).map((e) => ({
      id: e.id,
      name: e.name,
      equipment: e.equipment,
      archived: e.archived_at !== null,
      primaryMuscles: e.exercise_muscles.filter((m) => m.role === "primary").map((m) => m.muscle_group_id),
      secondaryMuscles: e.exercise_muscles.filter((m) => m.role === "secondary").map((m) => m.muscle_group_id),
    })),
  };
}

function csvField(value: string | number | boolean | null): string {
  const s = value === null ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** One row per logged set — the format most useful for spreadsheet analysis. */
export function toSetsCsv(data: ExportData): string {
  const header = ["workout_date", "workout_name", "exercise_name", "set_number", "is_warmup", "weight_kg", "reps", "rpe"];
  const rows = [header.join(",")];
  for (const w of data.workouts) {
    const date = new Date(w.startedAt).toLocaleDateString("en-CA"); // YYYY-MM-DD, unambiguous
    for (const ex of w.exercises) {
      for (const s of ex.sets) {
        rows.push(
          [date, w.name, ex.name, s.setNumber, s.isWarmup, s.weightKg, s.reps, s.rpe]
            .map((v) => csvField(v as string | number | boolean | null))
            .join(","),
        );
      }
    }
  }
  return rows.join("\r\n");
}

function download(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function todayStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function exportAsJson(): Promise<void> {
  const data = await buildExportData();
  download(JSON.stringify(data, null, 2), `workout-tracker-export-${todayStamp()}.json`, "application/json");
}

export async function exportAsCsv(): Promise<void> {
  const data = await buildExportData();
  download(toSetsCsv(data), `workout-tracker-sets-${todayStamp()}.csv`, "text/csv");
}
