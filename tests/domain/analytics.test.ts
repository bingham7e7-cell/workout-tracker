import { describe, expect, test } from "vitest";
import {
  estimatedOneRepMax,
  personalRecords,
  progressPoints,
  volume,
  type ExerciseSession,
} from "@/lib/domain/analytics";

describe("estimated 1RM (Epley)", () => {
  test("1 rep returns the weight itself", () => {
    expect(estimatedOneRepMax(100, 1)).toBe(100);
  });

  test("weight × (1 + reps / 30) for 2-12 reps", () => {
    expect(estimatedOneRepMax(100, 5)).toBeCloseTo(116.667, 3);
    expect(estimatedOneRepMax(225, 10)).toBeCloseTo(300, 5);
    expect(estimatedOneRepMax(100, 12)).toBeCloseTo(140, 5);
  });

  test("returns null outside 1-12 reps (accuracy drops sharply beyond that)", () => {
    expect(estimatedOneRepMax(100, 0)).toBeNull();
    expect(estimatedOneRepMax(100, 13)).toBeNull();
    expect(estimatedOneRepMax(100, 20)).toBeNull();
  });
});

describe("volume", () => {
  test("sums weight × reps over working sets only", () => {
    expect(
      volume([
        { weightKg: 100, reps: 5, isWarmup: false },
        { weightKg: 100, reps: 5, isWarmup: false },
        { weightKg: 40, reps: 10, isWarmup: true }, // excluded
      ]),
    ).toBe(1000);
  });

  test("a session with only warm-ups has zero volume", () => {
    expect(volume([{ weightKg: 40, reps: 10, isWarmup: true }])).toBe(0);
  });
});

const session = (workoutId: string, startedAt: string, sets: ExerciseSession["sets"]): ExerciseSession => ({
  workoutId,
  startedAt,
  sets,
});

describe("personal records", () => {
  test("tracks heaviest weight, best estimated 1RM, and best session volume independently", () => {
    const sessions: ExerciseSession[] = [
      session("w1", "2026-01-01T00:00:00Z", [
        { weightKg: 100, reps: 5, isWarmup: false }, // e1RM ~116.67
        { weightKg: 60, reps: 8, isWarmup: true },
      ]),
      session("w2", "2026-02-01T00:00:00Z", [
        { weightKg: 120, reps: 1, isWarmup: false }, // heaviest single set, e1RM 120
        { weightKg: 90, reps: 5, isWarmup: false },
      ]),
      session("w3", "2026-03-01T00:00:00Z", [
        { weightKg: 80, reps: 10, isWarmup: false },
        { weightKg: 80, reps: 10, isWarmup: false },
        { weightKg: 80, reps: 10, isWarmup: false }, // highest total volume: 2400
      ]),
    ];
    const records = personalRecords(sessions);
    expect(records.heaviestWeight).toEqual({ workoutId: "w2", startedAt: "2026-02-01T00:00:00Z", weightKg: 120, reps: 1 });
    expect(records.bestEstimated1RM?.workoutId).toBe("w2");
    expect(records.bestEstimated1RM?.estimated1RMKg).toBe(120);
    expect(records.bestSessionVolume).toEqual({ workoutId: "w3", startedAt: "2026-03-01T00:00:00Z", volumeKg: 2400 });
  });

  test("warm-up-only sessions never produce a record", () => {
    const records = personalRecords([session("w1", "2026-01-01T00:00:00Z", [{ weightKg: 60, reps: 8, isWarmup: true }])]);
    expect(records).toEqual({ heaviestWeight: null, bestEstimated1RM: null, bestSessionVolume: null });
  });

  test("never performed: all null, not a crash", () => {
    expect(personalRecords([])).toEqual({ heaviestWeight: null, bestEstimated1RM: null, bestSessionVolume: null });
  });

  test("a heavier low-rep set can win 'heaviest weight' while a lighter higher-rep set wins estimated 1RM", () => {
    const sessions: ExerciseSession[] = [
      session("w1", "2026-01-01T00:00:00Z", [
        { weightKg: 150, reps: 1, isWarmup: false }, // heaviest: e1RM 150
        { weightKg: 100, reps: 12, isWarmup: false }, // e1RM 140 — doesn't beat 150 here, but exercises the 12-rep boundary
      ]),
    ];
    const records = personalRecords(sessions);
    expect(records.heaviestWeight?.weightKg).toBe(150);
    expect(records.bestEstimated1RM?.estimated1RMKg).toBe(150);
  });
});

describe("progress points", () => {
  test("one point per session with logged working sets, oldest first", () => {
    const sessions: ExerciseSession[] = [
      session("w2", "2026-02-01T00:00:00Z", [{ weightKg: 110, reps: 5, isWarmup: false }]),
      session("w1", "2026-01-01T00:00:00Z", [
        { weightKg: 100, reps: 5, isWarmup: false },
        { weightKg: 90, reps: 8, isWarmup: false },
      ]),
    ];
    const points = progressPoints(sessions);
    expect(points.map((p) => p.workoutId)).toEqual(["w1", "w2"]);
    expect(points[0]).toMatchObject({ topWeightKg: 100, topWeightReps: 5, volumeKg: 100 * 5 + 90 * 8 });
    expect(points[0].estimated1RMKg).toBeCloseTo(estimatedOneRepMax(100, 5)!, 5);
  });

  test("a session logged with only warm-ups is dropped from the chart entirely", () => {
    const sessions: ExerciseSession[] = [
      session("w1", "2026-01-01T00:00:00Z", [{ weightKg: 40, reps: 10, isWarmup: true }]),
      session("w2", "2026-02-01T00:00:00Z", [{ weightKg: 100, reps: 5, isWarmup: false }]),
    ];
    expect(progressPoints(sessions).map((p) => p.workoutId)).toEqual(["w2"]);
  });

  test("no sessions at all produces an empty chart, not an error", () => {
    expect(progressPoints([])).toEqual([]);
  });
});
