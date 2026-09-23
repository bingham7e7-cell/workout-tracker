import { describe, expect, test } from "vitest";
import { muscleWorkload, recencyFactor, roleWorkload, workloadBucket, type WorkloadSet } from "@/lib/domain/workload";

const NOW = new Date("2026-09-08T00:00:00Z");

function set(overrides: Partial<WorkloadSet> = {}): WorkloadSet {
  return {
    weightKg: 100,
    reps: 5,
    rpe: null,
    isWarmup: false,
    finishedAt: NOW.toISOString(),
    muscles: [{ muscleGroupId: "chest", role: "primary" }],
    ...overrides,
  };
}

describe("recency factor", () => {
  test("1.0 right at finish time, halves every 48 hours", () => {
    expect(recencyFactor(0)).toBe(1);
    expect(recencyFactor(48)).toBeCloseTo(0.5, 10);
    expect(recencyFactor(96)).toBeCloseTo(0.25, 10);
    expect(recencyFactor(144)).toBeCloseTo(0.125, 10);
  });

  test("a future finish time (clock skew) is treated as just now, not amplified", () => {
    expect(recencyFactor(-5)).toBe(1);
  });
});

describe("workload buckets", () => {
  test.each([
    [0, "untrained"],
    [1.9, "light"],
    [2, "moderate"],
    [4.9, "moderate"],
    [5, "high"],
    [8.9, "high"],
    [9, "very_high"],
    [50, "very_high"],
  ] as const)("%d -> %s", (score, bucket) => {
    expect(workloadBucket(score)).toBe(bucket);
  });
});

describe("muscle workload", () => {
  test("warm-up sets never contribute", () => {
    const workload = muscleWorkload([set({ isWarmup: true })], NOW);
    expect(workload).toEqual({});
  });

  test("a single working set with known RPE and a primary muscle, finished now", () => {
    // effort = clamp(8/10) = 0.8, role = 1.0 (primary), recency = 1.0 -> 0.8
    const workload = muscleWorkload([set({ rpe: 8 })], NOW);
    expect(workload.chest).toBeCloseTo(0.8, 10);
  });

  test("unknown RPE defaults to 0.8 effort", () => {
    const workload = muscleWorkload([set({ rpe: null })], NOW);
    expect(workload.chest).toBeCloseTo(0.8, 10);
  });

  test("RPE is clamped to [0.5, 1.0] effort even for very low/invalid values", () => {
    expect(muscleWorkload([set({ rpe: 1 })], NOW).chest).toBeCloseTo(0.5, 10);
    expect(muscleWorkload([set({ rpe: 10 })], NOW).chest).toBeCloseTo(1.0, 10);
  });

  test("secondary muscles get half the role weight of primary", () => {
    const workload = muscleWorkload(
      [
        set({
          rpe: 10,
          muscles: [
            { muscleGroupId: "chest", role: "primary" },
            { muscleGroupId: "triceps", role: "secondary" },
          ],
        }),
      ],
      NOW,
    );
    expect(workload.chest).toBeCloseTo(1.0, 10);
    expect(workload.triceps).toBeCloseTo(0.5, 10);
  });

  test("older sets contribute less, decaying by the 48h half-life", () => {
    const twoDaysAgo = new Date(NOW.getTime() - 48 * 3_600_000).toISOString();
    const workload = muscleWorkload([set({ rpe: 10, finishedAt: twoDaysAgo })], NOW);
    expect(workload.chest).toBeCloseTo(0.5, 10); // effort 1.0 * role 1.0 * recency 0.5
  });

  test("contributions to the same muscle from multiple sets/sessions sum", () => {
    const yesterday = new Date(NOW.getTime() - 24 * 3_600_000).toISOString();
    const workload = muscleWorkload(
      [set({ rpe: 10, finishedAt: NOW.toISOString() }), set({ rpe: 10, finishedAt: yesterday })],
      NOW,
    );
    const recencyYesterday = Math.pow(0.5, 24 / 48);
    expect(workload.chest).toBeCloseTo(1 + recencyYesterday, 10);
  });

  test("an exercise hitting both a primary and secondary muscle contributes to both independently", () => {
    const workload = muscleWorkload(
      [
        set({
          rpe: null,
          muscles: [
            { muscleGroupId: "quads", role: "primary" },
            { muscleGroupId: "glutes", role: "secondary" },
          ],
        }),
      ],
      NOW,
    );
    expect(workload.quads).toBeCloseTo(0.8, 10);
    expect(workload.glutes).toBeCloseTo(0.4, 10);
  });

  test("no sets logged yet: empty workload, not a crash", () => {
    expect(muscleWorkload([], NOW)).toEqual({});
  });
});

describe("role workload (exercise detail diagram illustration)", () => {
  test("primary muscles score into the very-high bucket, secondary into high", () => {
    const workload = roleWorkload(["chest", "front_delts"], ["triceps"]);
    expect(workloadBucket(workload.chest)).toBe("very_high");
    expect(workloadBucket(workload.front_delts)).toBe("very_high");
    expect(workloadBucket(workload.triceps)).toBe("high");
  });

  test("a muscle listed as both primary and secondary keeps the primary (stronger) score", () => {
    const workload = roleWorkload(["chest"], ["chest"]);
    expect(workloadBucket(workload.chest)).toBe("very_high");
  });
});
