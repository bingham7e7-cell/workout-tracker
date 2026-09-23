/**
 * Muscle workload: a deterministic, transparent estimate of recent training
 * exposure per muscle group. NOT a medical recovery/readiness score — see
 * docs/ARCHITECTURE.md §6 for the formula, documented here in code:
 *
 *   contribution = effort × role × recency
 *     effort  = RPE known ? clamp(RPE / 10, 0.5, 1.0) : 0.8
 *     role    = 1.0 if primary muscle, 0.5 if secondary
 *     recency = 0.5 ^ (hours since workout finished / 48)   (halves every 48h)
 *   muscle workload = sum of contributions ("effective recent sets")
 *
 * Warm-up sets are always excluded (CLAUDE.md data rules).
 */

export type MuscleRole = "primary" | "secondary";

export type WorkloadSet = {
  weightKg: number;
  reps: number;
  rpe: number | null;
  isWarmup: boolean;
  /** When the workout containing this set was finished. */
  finishedAt: string;
  /** This set's exercise, mapped to the muscles it trains. */
  muscles: { muscleGroupId: string; role: MuscleRole }[];
};

const RECENCY_HALF_LIFE_HOURS = 48;
const DEFAULT_EFFORT = 0.8;

function effortOf(rpe: number | null): number {
  if (rpe === null) return DEFAULT_EFFORT;
  return Math.min(1, Math.max(0.5, rpe / 10));
}

function roleWeight(role: MuscleRole): number {
  return role === "primary" ? 1 : 0.5;
}

/** 0.5 ^ (hours / 48) — 1.0 right at the finish, halving every 48 hours. */
export function recencyFactor(hoursSinceFinished: number): number {
  if (hoursSinceFinished < 0) return 1; // A finish time in the future (clock skew) is treated as "just now".
  return Math.pow(0.5, hoursSinceFinished / RECENCY_HALF_LIFE_HOURS);
}

export type MuscleWorkload = Record<string, number>;

/** Per-muscle-group workload, as of `now`, from a flat list of sets (warm-ups included — they're filtered here). */
export function muscleWorkload(sets: WorkloadSet[], now: Date = new Date()): MuscleWorkload {
  const workload: MuscleWorkload = {};
  for (const set of sets) {
    if (set.isWarmup) continue;
    const hours = (now.getTime() - Date.parse(set.finishedAt)) / 3_600_000;
    const recency = recencyFactor(hours);
    if (recency <= 0) continue;
    const effort = effortOf(set.rpe);
    for (const m of set.muscles) {
      const contribution = effort * roleWeight(m.role) * recency;
      workload[m.muscleGroupId] = (workload[m.muscleGroupId] ?? 0) + contribution;
    }
  }
  return workload;
}

export type WorkloadBucket = "untrained" | "light" | "moderate" | "high" | "very_high";

/** Buckets a workload score for coloring: 0 = untrained, <2 light, 2–5 moderate, 5–9 high, ≥9 very high. */
export function workloadBucket(score: number): WorkloadBucket {
  if (score <= 0) return "untrained";
  if (score < 2) return "light";
  if (score < 5) return "moderate";
  if (score < 9) return "high";
  return "very_high";
}
