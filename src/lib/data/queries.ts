/**
 * Server-side reads. They run as the signed-in user, so Row Level Security
 * guarantees only that user's rows come back. Errors are thrown and shown
 * by the nearest error.tsx ("Couldn't load — try again").
 */
import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { isWeightUnit, type WeightUnit } from "@/lib/domain/units";

export async function getWeightUnit(): Promise<WeightUnit> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.from("profiles").select("weight_unit").maybeSingle();
  if (error) throw error;
  return isWeightUnit(data?.weight_unit) ? data.weight_unit : "lb";
}

export type TemplateSummary = {
  id: string;
  name: string;
  exercises: { exerciseId: string; name: string; targetSets: number | null; targetReps: number | null }[];
};

type TemplateRow = {
  id: string;
  name: string;
  notes: string | null;
  template_exercises: {
    position: number;
    exercise_id: string;
    target_sets: number | null;
    target_reps: number | null;
    exercises: { name: string } | null;
  }[];
};

function toTemplateSummary(t: TemplateRow): TemplateSummary {
  return {
    id: t.id,
    name: t.name,
    exercises: [...t.template_exercises]
      .sort((a, b) => a.position - b.position)
      .map((te) => ({
        exerciseId: te.exercise_id,
        name: te.exercises?.name ?? "Unknown exercise",
        targetSets: te.target_sets,
        targetReps: te.target_reps,
      })),
  };
}

const TEMPLATE_SELECT =
  "id, name, notes, template_exercises(position, exercise_id, target_sets, target_reps, exercises(name))";

export async function listTemplates(): Promise<TemplateSummary[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.from("templates").select(TEMPLATE_SELECT).order("name");
  if (error) throw error;
  return (data as unknown as TemplateRow[]).map(toTemplateSummary);
}

export async function getTemplate(id: string): Promise<(TemplateSummary & { notes: string | null }) | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.from("templates").select(TEMPLATE_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as unknown as TemplateRow;
  return { ...toTemplateSummary(row), notes: row.notes };
}

export type WorkoutSummary = {
  id: string;
  name: string;
  startedAt: string;
  finishedAt: string;
  exerciseCount: number;
};

export async function listWorkouts(limit = 100): Promise<WorkoutSummary[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("workouts")
    .select("id, name, started_at, finished_at, workout_exercises(count)")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as unknown as {
    id: string;
    name: string;
    started_at: string;
    finished_at: string;
    workout_exercises: { count: number }[];
  }[]).map((w) => ({
    id: w.id,
    name: w.name,
    startedAt: w.started_at,
    finishedAt: w.finished_at,
    exerciseCount: w.workout_exercises[0]?.count ?? 0,
  }));
}

export type WorkoutDetail = {
  id: string;
  name: string;
  startedAt: string;
  finishedAt: string;
  notes: string | null;
  exercises: {
    id: string;
    exerciseId: string;
    name: string;
    sets: { id: string; weightKg: number; reps: number; rpe: number | null; isWarmup: boolean }[];
  }[];
};

export async function getWorkout(id: string): Promise<WorkoutDetail | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("workouts")
    .select(
      "id, name, started_at, finished_at, notes, workout_exercises(id, exercise_id, exercise_name, position, workout_sets(id, position, weight_kg, reps, rpe, is_warmup))",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const w = data as unknown as {
    id: string;
    name: string;
    started_at: string;
    finished_at: string;
    notes: string | null;
    workout_exercises: {
      id: string;
      exercise_id: string;
      exercise_name: string;
      position: number;
      workout_sets: { id: string; position: number; weight_kg: number | string; reps: number; rpe: number | string | null; is_warmup: boolean }[];
    }[];
  };
  return {
    id: w.id,
    name: w.name,
    startedAt: w.started_at,
    finishedAt: w.finished_at,
    notes: w.notes,
    exercises: [...w.workout_exercises]
      .sort((a, b) => a.position - b.position)
      .map((we) => ({
        id: we.id,
        exerciseId: we.exercise_id,
        name: we.exercise_name,
        sets: [...we.workout_sets]
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            id: s.id,
            weightKg: Number(s.weight_kg),
            reps: s.reps,
            rpe: s.rpe == null ? null : Number(s.rpe),
            isWarmup: s.is_warmup,
          })),
      })),
  };
}
