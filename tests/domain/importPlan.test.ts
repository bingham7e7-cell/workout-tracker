import { describe, expect, test } from "vitest";
import {
  buildImportPayload,
  buildPreview,
  extractJson,
  parseImportReply,
  repTarget,
  validateImportPreview,
  type PreviewPlan,
} from "@/lib/domain/importPlan";

const VALID_REPLY = JSON.stringify({
  plan_name: "Push/Pull/Legs",
  workouts: [
    {
      name: "Push",
      exercises: [
        { name: "Barbell Bench Press", sets: 4, rep_range: { min: 6, max: 8 }, rpe: 8 },
        {
          name: "Cable Y-Raise",
          sets: 3,
          rep_range: { min: 12, max: 15 },
          rpe: null,
          primary_muscles: ["Rear delts"],
          secondary_muscles: ["Traps"],
        },
      ],
    },
  ],
});

describe("extractJson", () => {
  test("parses a bare JSON object", () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  test("finds JSON surrounded by prose", () => {
    expect(extractJson(`Sure, here's your plan:\n\n${VALID_REPLY}\n\nLet me know if you want changes!`)).toEqual(
      JSON.parse(VALID_REPLY),
    );
  });

  test("handles nested braces correctly", () => {
    const nested = '{"a": {"b": {"c": 1}}}';
    expect(extractJson(nested)).toEqual({ a: { b: { c: 1 } } });
  });

  test("returns null when there's no JSON at all", () => {
    expect(extractJson("Sorry, I can't help with that.")).toBeNull();
  });

  test("skips an unparsable brace span and finds the real JSON after it", () => {
    expect(extractJson('{not json} then {"a":1}')).toEqual({ a: 1 });
  });
});

describe("parseImportReply", () => {
  test("accepts a valid reply", () => {
    const result = parseImportReply(VALID_REPLY);
    expect(result.ok).toBe(true);
  });

  test("accepts a valid reply wrapped in markdown/prose", () => {
    const result = parseImportReply(`\`\`\`json\n${VALID_REPLY}\n\`\`\``);
    expect(result.ok).toBe(true);
  });

  test("reports a plain-language problem for unreadable text", () => {
    const result = parseImportReply("I don't know how to do that.");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.length).toBeGreaterThan(0);
  });

  test("reports a plain-language problem for JSON missing required fields", () => {
    const result = parseImportReply('{"plan_name": "X"}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems.some((p) => p.includes("workouts"))).toBe(true);
  });

  test("reports a problem for an empty paste", () => {
    const result = parseImportReply("   ");
    expect(result.ok).toBe(false);
  });

  test("rejects a rep_range where max is below min", () => {
    const bad = JSON.parse(VALID_REPLY);
    bad.workouts[0].exercises[0].rep_range = { min: 10, max: 5 };
    const result = parseImportReply(JSON.stringify(bad));
    expect(result.ok).toBe(false);
  });
});

describe("buildPreview: matching against the user's own library", () => {
  const existing = [
    { id: "id-1", name: "Barbell Bench Press" },
    { id: "id-2", name: "barbell row" }, // stored lowercase in this test to prove case-insensitivity
  ];

  test("an exact (case-insensitive) name match is Matched", () => {
    const parsed = parseImportReply(VALID_REPLY);
    if (!parsed.ok) throw new Error("expected ok");
    const preview = buildPreview(parsed.data, existing);
    const bench = preview.workouts[0].exercises[0];
    expect(bench.kind).toBe("matched");
    if (bench.kind === "matched") expect(bench.exerciseId).toBe("id-1");
  });

  test("a name not in the library is New, keeping its given muscles", () => {
    const parsed = parseImportReply(VALID_REPLY);
    if (!parsed.ok) throw new Error("expected ok");
    const preview = buildPreview(parsed.data, existing);
    const yRaise = preview.workouts[0].exercises[1];
    expect(yRaise.kind).toBe("new");
    if (yRaise.kind === "new") {
      expect(yRaise.primaryMuscles).toEqual(["Rear delts"]);
      expect(yRaise.secondaryMuscles).toEqual(["Traps"]);
    }
  });
});

describe("validateImportPreview", () => {
  const validMuscles = ["Chest", "Rear delts", "Traps"];

  function preview(exercise: Partial<{ name: string; primaryMuscles: string[]; secondaryMuscles: string[] }>): PreviewPlan {
    return {
      planName: "Plan",
      workouts: [
        {
          key: "w1",
          name: "Workout",
          exercises: [
            {
              key: "e1",
              kind: "new",
              name: "New Move",
              sets: 3,
              repMin: 8,
              repMax: 12,
              rpe: null,
              primaryMuscles: [],
              secondaryMuscles: [],
              ...exercise,
            },
          ],
        },
      ],
    };
  }

  test("no problems for a valid new exercise", () => {
    expect(validateImportPreview(preview({ primaryMuscles: ["Chest"] }), validMuscles, [])).toEqual([]);
  });

  test("flags a new exercise with no primary muscle", () => {
    const problems = validateImportPreview(preview({ primaryMuscles: [] }), validMuscles, []);
    expect(problems.some((p) => p.includes("primary muscle"))).toBe(true);
  });

  test("flags a muscle that isn't on the valid list", () => {
    const problems = validateImportPreview(preview({ primaryMuscles: ["Not A Real Muscle"] }), validMuscles, []);
    expect(problems.some((p) => p.includes("Not A Real Muscle"))).toBe(true);
  });

  test("flags a new exercise whose name duplicates one the user already has", () => {
    const problems = validateImportPreview(
      preview({ name: "Barbell Bench Press", primaryMuscles: ["Chest"] }),
      validMuscles,
      ["Barbell Bench Press"],
    );
    expect(problems.some((p) => p.includes("already have"))).toBe(true);
  });

  test("flags two new exercises sharing the same name", () => {
    const plan: PreviewPlan = {
      planName: "Plan",
      workouts: [
        {
          key: "w1",
          name: "Workout",
          exercises: [
            { key: "e1", kind: "new", name: "Dup", sets: 3, repMin: 8, repMax: 12, rpe: null, primaryMuscles: ["Chest"], secondaryMuscles: [] },
            { key: "e2", kind: "new", name: "dup", sets: 3, repMin: 8, repMax: 12, rpe: null, primaryMuscles: ["Chest"], secondaryMuscles: [] },
          ],
        },
      ],
    };
    const problems = validateImportPreview(plan, validMuscles, []);
    expect(problems.some((p) => p.includes("more than one new exercise"))).toBe(true);
  });

  test("a Matched exercise is never validated (no muscles to check)", () => {
    const plan: PreviewPlan = {
      planName: "Plan",
      workouts: [
        { key: "w1", name: "Workout", exercises: [{ key: "e1", kind: "matched", name: "X", sets: 3, repMin: 8, repMax: 12, rpe: null, exerciseId: "id-1" }] },
      ],
    };
    expect(validateImportPreview(plan, validMuscles, [])).toEqual([]);
  });
});

describe("repTarget", () => {
  test("rounds the midpoint of the range", () => {
    expect(repTarget(6, 8)).toBe(7);
    expect(repTarget(8, 12)).toBe(10);
    expect(repTarget(5, 5)).toBe(5);
    expect(repTarget(8, 13)).toBe(11); // 10.5 rounds up
  });
});

describe("buildImportPayload", () => {
  test("converts a preview into the RPC payload shape", () => {
    const preview: PreviewPlan = {
      planName: "My Plan",
      workouts: [
        {
          key: "w1",
          name: "Day 1",
          exercises: [
            { key: "e1", kind: "matched", name: "Bench", sets: 4, repMin: 6, repMax: 8, rpe: 8, exerciseId: "id-1" },
            {
              key: "e2",
              kind: "new",
              name: "  Cable Y-Raise  ",
              sets: 3,
              repMin: 12,
              repMax: 15,
              rpe: null,
              primaryMuscles: ["Rear delts"],
              secondaryMuscles: ["Traps"],
            },
          ],
        },
      ],
    };
    const muscleNameToId = new Map([
      ["rear delts", "shoulders_rear"],
      ["traps", "trapezius"],
    ]);
    expect(buildImportPayload(preview, muscleNameToId)).toEqual({
      plan_name: "My Plan",
      workouts: [
        {
          name: "Day 1",
          exercises: [
            { kind: "matched", exercise_id: "id-1", sets: 4, reps: 7 },
            { kind: "new", name: "Cable Y-Raise", primary: ["shoulders_rear"], secondary: ["trapezius"], sets: 3, reps: 14 },
          ],
        },
      ],
    });
  });

  test("drops a muscle name with no matching id rather than failing", () => {
    const preview: PreviewPlan = {
      planName: "P",
      workouts: [
        {
          key: "w1",
          name: "D1",
          exercises: [
            { key: "e1", kind: "new", name: "X", sets: 3, repMin: 8, repMax: 12, rpe: null, primaryMuscles: ["Unknown"], secondaryMuscles: [] },
          ],
        },
      ],
    };
    const result = buildImportPayload(preview, new Map());
    expect(result.workouts[0].exercises[0]).toMatchObject({ primary: [], secondary: [] });
  });
});
