/**
 * Server-side reads. They run as the signed-in user, so Row Level Security
 * guarantees only that user's rows come back. Errors are thrown and shown
 * by the nearest error.tsx ("Couldn't load — try again").
 */
import "server-only";
import { getSupabaseServer } from "@/lib/supabase/server";
import { personalRecords, type ExerciseSession, type PersonalRecords } from "@/lib/domain/analytics";
import { isWeightUnit, type WeightUnit } from "@/lib/domain/units";
import { isTimeZoneMode, type TimeZoneMode } from "@/lib/format";
import type { MuscleRole, WorkloadSet } from "@/lib/domain/workload";

export async function getWeightUnit(): Promise<WeightUnit> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.from("profiles").select("weight_unit").maybeSingle();
  if (error) throw error;
  return isWeightUnit(data?.weight_unit) ? data.weight_unit : "lb";
}

export async function getTimeZoneMode(): Promise<TimeZoneMode> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.from("profiles").select("time_zone_mode").maybeSingle();
  if (error) throw error;
  return isTimeZoneMode(data?.time_zone_mode) ? data.time_zone_mode : "auto";
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

export type ExerciseListItem = { id: string; name: string; equipment: string | null; archived: boolean };

export async function listExercises(): Promise<ExerciseListItem[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.from("exercises").select("id, name, equipment, archived_at").order("name");
  if (error) throw error;
  return (data as { id: string; name: string; equipment: string | null; archived_at: string | null }[]).map((e) => ({
    id: e.id,
    name: e.name,
    equipment: e.equipment,
    archived: e.archived_at !== null,
  }));
}

type SessionRow = {
  workout_id: string;
  workouts: { started_at: string } | null;
  workout_sets: { weight_kg: number | string; reps: number; rpe: number | string | null; is_warmup: boolean; position: number }[];
};

function toSessions(rows: SessionRow[]): ExerciseSession[] {
  return rows
    .filter((r) => r.workouts !== null)
    .map((r) => ({
      workoutId: r.workout_id,
      startedAt: r.workouts!.started_at,
      sets: [...r.workout_sets]
        .sort((a, b) => a.position - b.position)
        .map((s) => ({ weightKg: Number(s.weight_kg), reps: s.reps, isWarmup: s.is_warmup })),
    }))
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt)); // Deterministic tie-breaking in personalRecords.
}

export type ExerciseHistoryEntry = {
  workoutId: string;
  startedAt: string;
  sets: { weightKg: number; reps: number; rpe: number | null; isWarmup: boolean }[];
};

export type ExerciseHistory = {
  name: string;
  archived: boolean;
  /** Most recent session first — for the history log. */
  entries: ExerciseHistoryEntry[];
  records: PersonalRecords;
};

/** Every session an exercise was performed in, its personal records, and its history log. */
export async function getExerciseHistory(exerciseId: string): Promise<ExerciseHistory | null> {
  const supabase = await getSupabaseServer();
  const [{ data: exercise, error: exerciseError }, { data, error }] = await Promise.all([
    supabase.from("exercises").select("name, archived_at").eq("id", exerciseId).maybeSingle(),
    supabase
      .from("workout_exercises")
      .select("workout_id, workouts(started_at), workout_sets(weight_kg, reps, rpe, is_warmup, position)")
      .eq("exercise_id", exerciseId),
  ]);
  if (exerciseError) throw exerciseError;
  if (error) throw error;
  if (!exercise) return null;

  const rows = data as unknown as SessionRow[];

  return {
    name: exercise.name,
    archived: exercise.archived_at !== null,
    records: personalRecords(toSessions(rows)),
    entries: rows
      .filter((r) => r.workouts !== null)
      .map((r) => ({
        workoutId: r.workout_id,
        startedAt: r.workouts!.started_at,
        sets: [...r.workout_sets]
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            weightKg: Number(s.weight_kg),
            reps: s.reps,
            rpe: s.rpe == null ? null : Number(s.rpe),
            isWarmup: s.is_warmup,
          })),
      }))
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)),
  };
}

export type ExercisePRSummary = { exerciseId: string; name: string; records: PersonalRecords };

/** Personal records for every exercise the user has ever logged a working set for. */
export async function listExercisePRs(): Promise<ExercisePRSummary[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("workout_exercises")
    .select("exercise_id, exercises(name), workout_id, workouts(started_at), workout_sets(weight_kg, reps, is_warmup, position)");
  if (error) throw error;

  const byExercise = new Map<string, { name: string; rows: SessionRow[] }>();
  for (const row of data as unknown as (SessionRow & { exercise_id: string; exercises: { name: string } | null })[]) {
    const entry = byExercise.get(row.exercise_id) ?? { name: row.exercises?.name ?? "Unknown exercise", rows: [] };
    entry.rows.push(row);
    byExercise.set(row.exercise_id, entry);
  }

  return [...byExercise.entries()]
    .map(([exerciseId, { name, rows }]) => ({ exerciseId, name, records: personalRecords(toSessions(rows)) }))
    .filter((e) => e.records.heaviestWeight !== null)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export type PlanSummary = { id: string; name: string; workouts: { templateId: string; name: string }[] };

type PlanRow = {
  id: string;
  name: string;
  plan_workouts: { position: number; template_id: string; templates: { name: string } | null }[];
};

function toPlanSummary(p: PlanRow): PlanSummary {
  return {
    id: p.id,
    name: p.name,
    workouts: [...p.plan_workouts]
      .sort((a, b) => a.position - b.position)
      .map((pw) => ({ templateId: pw.template_id, name: pw.templates?.name ?? "Deleted template" })),
  };
}

const PLAN_SELECT = "id, name, plan_workouts(position, template_id, templates(name))";

export async function listPlans(): Promise<PlanSummary[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.from("plans").select(PLAN_SELECT).order("name");
  if (error) throw error;
  return (data as unknown as PlanRow[]).map(toPlanSummary);
}

export async function getPlan(id: string): Promise<PlanSummary | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.from("plans").select(PLAN_SELECT).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? toPlanSummary(data as unknown as PlanRow) : null;
}

export async function getActivePlanId(): Promise<string | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.from("profiles").select("active_plan_id").maybeSingle();
  if (error) throw error;
  return data?.active_plan_id ?? null;
}

export type ActivePlanNext = {
  planId: string;
  planName: string;
  position: number;
  totalWorkouts: number;
  workout: TemplateSummary;
};

type ActivePlanProfileRow = {
  active_plan_position: number;
  plans: { id: string; name: string; plan_workouts: { position: number; template_id: string; templates: TemplateRow | null }[] } | null;
};

/** The workout the user's active plan currently suggests, or null if there's no active plan (or it's empty). */
export async function getActivePlanNext(): Promise<ActivePlanNext | null> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .select(`active_plan_position, plans(id, name, plan_workouts(position, template_id, templates(${TEMPLATE_SELECT})))`)
    .maybeSingle();
  if (error) throw error;
  const row = data as unknown as ActivePlanProfileRow | null;
  const plan = row?.plans;
  if (!plan || plan.plan_workouts.length === 0) return null;

  const ordered = [...plan.plan_workouts].sort((a, b) => a.position - b.position);
  const index = row!.active_plan_position % ordered.length;
  const pw = ordered[index];
  if (!pw.templates) return null; // The template behind this slot was deleted (rare: cascades away on its own next save).

  return {
    planId: plan.id,
    planName: plan.name,
    position: index,
    totalWorkouts: ordered.length,
    workout: toTemplateSummary(pw.templates),
  };
}

/**
 * `finished_at` timestamps for workouts finished recently, for the home
 * screen's 7-day strip. Fetches a few extra days of buffer so the client can
 * bucket them into calendar days in whichever time zone the user has chosen
 * without missing one at the edge.
 */
export async function listRecentWorkoutDates(days = 10): Promise<string[]> {
  const supabase = await getSupabaseServer();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await supabase.from("workouts").select("finished_at").gte("finished_at", cutoff);
  if (error) throw error;
  return (data as { finished_at: string }[]).map((w) => w.finished_at);
}

export type ExerciseMuscle = { muscleGroupId: string; name: string; role: MuscleRole };

/** The muscles an exercise trains, with names, for the exercise detail screen's diagram + breakdown. */
export async function getExerciseMuscles(exerciseId: string): Promise<ExerciseMuscle[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase
    .from("exercise_muscles")
    .select("muscle_group_id, role, muscle_groups(name)")
    .eq("exercise_id", exerciseId);
  if (error) throw error;
  return (data as unknown as { muscle_group_id: string; role: string; muscle_groups: { name: string } | null }[]).map((r) => ({
    muscleGroupId: r.muscle_group_id,
    name: r.muscle_groups?.name ?? r.muscle_group_id,
    role: r.role as MuscleRole,
  }));
}

export type MuscleGroup = { id: string; name: string };

export async function listMuscleGroups(): Promise<MuscleGroup[]> {
  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.from("muscle_groups").select("id, name").order("sort_order");
  if (error) throw error;
  return data;
}

// Contributions decay by half every 48h (see lib/domain/workload.ts); by 21 days
// out a set's contribution is under 0.1% of its starting value, so this window
// captures everything that could meaningfully affect the current workload.
const WORKLOAD_WINDOW_DAYS = 21;

type WorkloadWorkoutRow = {
  finished_at: string;
  workout_exercises: { exercise_id: string; workout_sets: { weight_kg: number | string; reps: number; rpe: number | string | null; is_warmup: boolean }[] }[];
};

/** Every working set from the last 3 weeks, with each set's exercise mapped to the muscles it trains. */
export async function getRecentSetsForWorkload(): Promise<WorkloadSet[]> {
  const supabase = await getSupabaseServer();
  const cutoff = new Date(Date.now() - WORKLOAD_WINDOW_DAYS * 86_400_000).toISOString();

  const { data: workouts, error } = await supabase
    .from("workouts")
    .select("finished_at, workout_exercises(exercise_id, workout_sets(weight_kg, reps, rpe, is_warmup))")
    .gte("finished_at", cutoff);
  if (error) throw error;

  const rows = workouts as unknown as WorkloadWorkoutRow[];
  const exerciseIds = [...new Set(rows.flatMap((w) => w.workout_exercises.map((we) => we.exercise_id)))];
  if (exerciseIds.length === 0) return [];

  const { data: muscleRows, error: muscleError } = await supabase
    .from("exercise_muscles")
    .select("exercise_id, muscle_group_id, role")
    .in("exercise_id", exerciseIds);
  if (muscleError) throw muscleError;

  const musclesByExercise = new Map<string, { muscleGroupId: string; role: MuscleRole }[]>();
  for (const row of muscleRows as { exercise_id: string; muscle_group_id: string; role: string }[]) {
    const list = musclesByExercise.get(row.exercise_id) ?? [];
    list.push({ muscleGroupId: row.muscle_group_id, role: row.role as MuscleRole });
    musclesByExercise.set(row.exercise_id, list);
  }

  const sets: WorkloadSet[] = [];
  for (const w of rows) {
    for (const we of w.workout_exercises) {
      const muscles = musclesByExercise.get(we.exercise_id) ?? [];
      for (const s of we.workout_sets) {
        sets.push({
          weightKg: Number(s.weight_kg),
          reps: s.reps,
          rpe: s.rpe == null ? null : Number(s.rpe),
          isWarmup: s.is_warmup,
          finishedAt: w.finished_at,
          muscles,
        });
      }
    }
  }
  return sets;
}
