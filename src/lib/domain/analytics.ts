/**
 * Training analytics: estimated 1RM, personal records, and progress-chart data.
 * Pure functions only — no database, no React — so they're easy to test and to
 * reuse from both the per-exercise page and the cross-exercise PR overview.
 * Warm-up sets are always excluded, per CLAUDE.md's data rules.
 */

export type WorkingSet = { weightKg: number; reps: number; isWarmup: boolean };

/**
 * Estimated one-rep max — Epley formula: weight × (1 + reps / 30); reps = 1 → weight.
 * Only meaningful for 1–12 reps (accuracy drops sharply above that), so returns
 * `null` outside that range instead of a misleading number.
 */
export function estimatedOneRepMax(weightKg: number, reps: number): number | null {
  if (reps < 1 || reps > 12) return null;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Σ weight × reps over working (non-warm-up) sets. */
export function volume(sets: WorkingSet[]): number {
  return sets.filter((s) => !s.isWarmup).reduce((sum, s) => sum + s.weightKg * s.reps, 0);
}

export type ExerciseSession = {
  workoutId: string;
  startedAt: string;
  sets: WorkingSet[];
};

export type PersonalRecord = { workoutId: string; startedAt: string; weightKg: number; reps: number };
export type VolumeRecord = { workoutId: string; startedAt: string; volumeKg: number };

export type PersonalRecords = {
  /** The single heaviest set ever logged (any rep count). */
  heaviestWeight: PersonalRecord | null;
  /** The set with the highest estimated 1RM ever logged. */
  bestEstimated1RM: (PersonalRecord & { estimated1RMKg: number }) | null;
  /** The single workout session with the most total volume for this exercise. */
  bestSessionVolume: VolumeRecord | null;
};

const EMPTY_RECORDS: PersonalRecords = { heaviestWeight: null, bestEstimated1RM: null, bestSessionVolume: null };

/** Computes personal records for one exercise from every session it was performed in. */
export function personalRecords(sessions: ExerciseSession[]): PersonalRecords {
  let records = EMPTY_RECORDS;

  for (const session of sessions) {
    const working = session.sets.filter((s) => !s.isWarmup);
    if (working.length === 0) continue;

    const sessionVolumeKg = volume(working);
    if (records.bestSessionVolume === null || sessionVolumeKg > records.bestSessionVolume.volumeKg) {
      records = {
        ...records,
        bestSessionVolume: { workoutId: session.workoutId, startedAt: session.startedAt, volumeKg: sessionVolumeKg },
      };
    }

    for (const s of working) {
      if (records.heaviestWeight === null || s.weightKg > records.heaviestWeight.weightKg) {
        records = {
          ...records,
          heaviestWeight: { workoutId: session.workoutId, startedAt: session.startedAt, weightKg: s.weightKg, reps: s.reps },
        };
      }
      const est = estimatedOneRepMax(s.weightKg, s.reps);
      if (est !== null && (records.bestEstimated1RM === null || est > records.bestEstimated1RM.estimated1RMKg)) {
        records = {
          ...records,
          bestEstimated1RM: {
            workoutId: session.workoutId,
            startedAt: session.startedAt,
            weightKg: s.weightKg,
            reps: s.reps,
            estimated1RMKg: est,
          },
        };
      }
    }
  }
  return records;
}

export type ProgressPoint = {
  workoutId: string;
  startedAt: string;
  /** The heaviest working set logged that session (weight, then its rep count). */
  topWeightKg: number | null;
  topWeightReps: number | null;
  volumeKg: number;
  /** The best estimated 1RM from any working set that session. */
  estimated1RMKg: number | null;
};

/** One point per session, oldest first — ready to feed straight into a chart. */
export function progressPoints(sessions: ExerciseSession[]): ProgressPoint[] {
  return sessions
    .map((session): ProgressPoint => {
      const working = session.sets.filter((s) => !s.isWarmup);
      let topWeightKg: number | null = null;
      let topWeightReps: number | null = null;
      let estimated1RMKg: number | null = null;
      for (const s of working) {
        if (topWeightKg === null || s.weightKg > topWeightKg) {
          topWeightKg = s.weightKg;
          topWeightReps = s.reps;
        }
        const est = estimatedOneRepMax(s.weightKg, s.reps);
        if (est !== null && (estimated1RMKg === null || est > estimated1RMKg)) estimated1RMKg = est;
      }
      return {
        workoutId: session.workoutId,
        startedAt: session.startedAt,
        topWeightKg,
        topWeightReps,
        volumeKg: volume(working),
        estimated1RMKg,
      };
    })
    .filter((p) => p.topWeightKg !== null) // Sessions with only warm-ups logged don't plot.
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
}
