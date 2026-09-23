/**
 * Validation rules shared by the app. The database enforces the same limits
 * with CHECK constraints as a second line of defence.
 */
import { z } from "zod";

export const MAX_WEIGHT_KG = 1000;
export const MAX_REPS = 999;
export const MAX_NAME_LENGTH = 100;

const name = z.string().trim().min(1, "Name is required").max(MAX_NAME_LENGTH, "Name is too long");

export const rpeSchema = z
  .number()
  .min(1)
  .max(10)
  .refine((v) => Number.isInteger(v * 2), "RPE must be in steps of 0.5");

export const setPayloadSchema = z.object({
  weight_kg: z.number().min(0).max(MAX_WEIGHT_KG),
  reps: z.number().int().min(1, "Reps must be at least 1").max(MAX_REPS),
  rpe: rpeSchema.nullable(),
  is_warmup: z.boolean(),
});

export const workoutPayloadSchema = z
  .object({
    id: z.uuid(),
    name,
    template_id: z.uuid().nullable(),
    started_at: z.iso.datetime({ offset: true }),
    finished_at: z.iso.datetime({ offset: true }),
    notes: z.string().max(2000).nullable(),
    exercises: z
      .array(
        z.object({
          exercise_id: z.uuid(),
          notes: z.string().max(1000).nullable(),
          sets: z.array(setPayloadSchema).min(1).max(50),
        }),
      )
      .min(1, "Log at least one set before finishing")
      .max(50),
  })
  .refine((w) => Date.parse(w.finished_at) >= Date.parse(w.started_at), {
    message: "Finish time can't be before start time",
  });

export type WorkoutPayload = z.infer<typeof workoutPayloadSchema>;

export const templatePayloadSchema = z.object({
  id: z.uuid(),
  name,
  notes: z.string().max(2000).nullable(),
  exercises: z
    .array(
      z.object({
        exercise_id: z.uuid(),
        target_sets: z.number().int().min(1).max(20).nullable(),
        target_reps: z.number().int().min(1).max(100).nullable(),
      }),
    )
    .max(50),
});

export type TemplatePayload = z.infer<typeof templatePayloadSchema>;

export const planPayloadSchema = z.object({
  id: z.uuid().nullable(),
  name,
  template_ids: z.array(z.uuid()).min(1, "A plan needs at least one workout").max(50),
});

export type PlanPayload = z.infer<typeof planPayloadSchema>;

export const exerciseInputSchema = z.object({
  name,
  equipment: z.string().trim().max(50).nullable(),
  primary: z.array(z.string()).min(1, "Pick at least one primary muscle"),
  secondary: z.array(z.string()),
});

/** First human-readable message from a zod error. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}
