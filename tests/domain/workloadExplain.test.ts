import { describe, expect, test } from "vitest";
import { RECENCY_HALF_LIFE_HOURS, roleWeight } from "@/lib/domain/workload";
import { describeMuscleCredit, HOW_IT_WORKS_PARAGRAPHS, PRIMARY_CREDIT_PERCENT, SECONDARY_CREDIT_PERCENT } from "@/lib/domain/workloadExplain";

describe("workload explanation stays in sync with the real formula", () => {
  test("credit percentages match the formula's actual role weights", () => {
    // Pinned to literal numbers (not re-derived from roleWeight()) so this
    // actually fails if the formula's role weights ever change.
    expect(roleWeight("primary")).toBe(1);
    expect(roleWeight("secondary")).toBe(0.5);
    expect(PRIMARY_CREDIT_PERCENT).toBe(100);
    expect(SECONDARY_CREDIT_PERCENT).toBe(50);
  });

  test("describeMuscleCredit reports the real per-role percentages and names", () => {
    expect(describeMuscleCredit(["Chest", "Front delts"], ["Triceps"])).toEqual([
      "Primary (100% credit per set): Chest, Front delts.",
      "Secondary (50% credit per set): Triceps.",
    ]);
  });

  test("describeMuscleCredit omits a role with no muscles", () => {
    expect(describeMuscleCredit(["Chest"], [])).toEqual(["Primary (100% credit per set): Chest."]);
    expect(describeMuscleCredit([], ["Triceps"])).toEqual(["Secondary (50% credit per set): Triceps."]);
  });

  test("the how-it-works explanation cites the real half-life", () => {
    expect(RECENCY_HALF_LIFE_HOURS).toBe(48); // pinned literal, not just re-derived
    expect(HOW_IT_WORKS_PARAGRAPHS.some((p) => p.includes(`halves every ${RECENCY_HALF_LIFE_HOURS} hours`))).toBe(true);
  });
});
