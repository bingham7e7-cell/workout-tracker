import { describe, expect, test } from "vitest";
import {
  addExercise,
  addSet,
  countSets,
  createDraft,
  editDraftFromWorkout,
  moveExercise,
  parseNumber,
  removeExercise,
  removeSet,
  setPreviousSets,
  summarizePreviousSets,
  toSavePayload,
  toggleSetDone,
  updateSet,
  type PreviousSet,
  type WorkoutDraft,
} from "@/lib/domain/draft";

const BENCH = "11111111-1111-4111-8111-111111111111";
const SQUAT = "22222222-2222-4222-8222-222222222222";

function templateDraft(): WorkoutDraft {
  return createDraft({
    name: "Push A",
    templateId: "33333333-3333-4333-8333-333333333333",
    unit: "lb",
    exercises: [{ exerciseId: BENCH, name: "Bench", targetSets: 3, targetReps: 8 }],
    now: new Date("2026-09-01T10:00:00Z"),
  });
}

describe("creating a workout", () => {
  test("from a template: one row per target set, reps pre-filled", () => {
    const d = templateDraft();
    expect(d.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(d.exercises).toHaveLength(1);
    expect(d.exercises[0].sets.map((s) => [s.weight, s.reps, s.done])).toEqual([
      ["", "8", false],
      ["", "8", false],
      ["", "8", false],
    ]);
  });

  test("blank workout, then adding exercises", () => {
    let d = createDraft({ name: "Workout", templateId: null, unit: "kg", exercises: [] });
    d = addExercise(d, { exerciseId: SQUAT, name: "Squat" });
    expect(d.exercises[0].sets).toHaveLength(1);
    d = addExercise(d, { exerciseId: BENCH, name: "Bench" });
    d = moveExercise(d, d.exercises[1].key, -1);
    expect(d.exercises.map((e) => e.name)).toEqual(["Bench", "Squat"]);
    d = removeExercise(d, d.exercises[0].key);
    expect(d.exercises.map((e) => e.name)).toEqual(["Squat"]);
  });

  test("each workout gets a different id", () => {
    expect(templateDraft().id).not.toBe(templateDraft().id);
  });
});

describe("logging sets", () => {
  test("type once, then ✓ ✓ ✓: values carry forward to later sets", () => {
    let d = templateDraft();
    const ex = d.exercises[0];
    d = updateSet(d, ex.key, ex.sets[0].key, { weight: "185" });
    d = toggleSetDone(d, ex.key, ex.sets[0].key).draft;
    d = toggleSetDone(d, ex.key, ex.sets[1].key).draft;
    d = toggleSetDone(d, ex.key, ex.sets[2].key).draft;
    expect(d.exercises[0].sets.map((s) => [s.weight, s.reps, s.done])).toEqual([
      ["185", "8", true],
      ["185", "8", true],
      ["185", "8", true],
    ]);
  });

  test("a warm-up does not overwrite the working sets after it", () => {
    let d = templateDraft();
    const ex = d.exercises[0];
    d = updateSet(d, ex.key, ex.sets[0].key, { weight: "95", reps: "10", isWarmup: true });
    d = toggleSetDone(d, ex.key, ex.sets[0].key).draft;
    expect(d.exercises[0].sets.map((s) => [s.weight, s.reps])).toEqual([
      ["95", "10"],
      ["", "8"],
      ["", "8"],
    ]);
  });

  test("a set with missing or invalid values can't be logged", () => {
    const d = templateDraft();
    const ex = d.exercises[0];
    const r = toggleSetDone(d, ex.key, ex.sets[0].key);
    expect(r.error).toMatch(/weight/i);
    expect(r.draft.exercises[0].sets[0].done).toBe(false);

    const d2 = updateSet(d, ex.key, ex.sets[0].key, { weight: "100", reps: "2.5" });
    expect(toggleSetDone(d2, ex.key, ex.sets[0].key).error).toMatch(/reps/i);
    const d3 = updateSet(d, ex.key, ex.sets[0].key, { weight: "100", reps: "0" });
    expect(toggleSetDone(d3, ex.key, ex.sets[0].key).error).toMatch(/at least 1/i);
    const d4 = updateSet(d, ex.key, ex.sets[0].key, { weight: "5000", reps: "5" });
    expect(toggleSetDone(d4, ex.key, ex.sets[0].key).error).toMatch(/too high/i);
  });

  test("tapping ✓ again un-logs; sets can be edited and deleted", () => {
    let d = templateDraft();
    const ex = d.exercises[0];
    d = updateSet(d, ex.key, ex.sets[0].key, { weight: "100" });
    d = toggleSetDone(d, ex.key, ex.sets[0].key).draft;
    d = toggleSetDone(d, ex.key, ex.sets[0].key).draft;
    expect(d.exercises[0].sets[0].done).toBe(false);
    d = updateSet(d, ex.key, ex.sets[0].key, { weight: "105" });
    expect(d.exercises[0].sets[0].weight).toBe("105");
    d = removeSet(d, ex.key, ex.sets[1].key);
    expect(d.exercises[0].sets).toHaveLength(2);
  });

  test("add set copies the previous set's values", () => {
    let d = templateDraft();
    const ex = d.exercises[0];
    d = updateSet(d, ex.key, ex.sets[2].key, { weight: "200", reps: "6" });
    d = addSet(d, ex.key);
    const last = d.exercises[0].sets[3];
    expect([last.weight, last.reps, last.done]).toEqual(["200", "6", false]);
  });

  test("parseNumber accepts a decimal comma and rejects junk", () => {
    expect(parseNumber("22,5")).toBe(22.5);
    expect(parseNumber(" 100 ")).toBe(100);
    expect(parseNumber("")).toBeNull();
    expect(parseNumber("1.2.3")).toBeNull();
    expect(parseNumber("-5")).toBeNull();
    expect(parseNumber("abc")).toBeNull();
  });
});

describe("building the save payload", () => {
  test("only logged sets are included, in kg; empty exercises are dropped", () => {
    let d = templateDraft();
    d = addExercise(d, { exerciseId: SQUAT, name: "Squat" }); // never logged
    const ex = d.exercises[0];
    d = updateSet(d, ex.key, ex.sets[0].key, { weight: "225", rpe: 8 });
    d = toggleSetDone(d, ex.key, ex.sets[0].key).draft;
    expect(countSets(d)).toEqual({ logged: 1, unlogged: 3 });

    const r = toSavePayload(d, new Date("2026-09-01T11:00:00Z"));
    if ("error" in r) throw new Error(r.error);
    expect(r.payload).toEqual({
      id: d.id,
      name: "Push A",
      template_id: "33333333-3333-4333-8333-333333333333",
      started_at: "2026-09-01T10:00:00.000Z",
      finished_at: "2026-09-01T11:00:00.000Z",
      notes: null,
      exercises: [
        { exercise_id: BENCH, notes: null, sets: [{ weight_kg: 102.058, reps: 8, rpe: 8, is_warmup: false }] },
      ],
    });
  });

  test("finishing with nothing logged is an error", () => {
    const r = toSavePayload(templateDraft());
    expect(r).toEqual({ error: "Log at least one set before finishing" });
  });

  test("a logged set later edited to an invalid value is caught before saving", () => {
    let d = templateDraft();
    const ex = d.exercises[0];
    d = updateSet(d, ex.key, ex.sets[0].key, { weight: "100" });
    d = toggleSetDone(d, ex.key, ex.sets[0].key).draft;
    d = updateSet(d, ex.key, ex.sets[0].key, { reps: "" });
    const r = toSavePayload(d);
    expect("error" in r && r.error).toMatch(/Bench: .*reps/i);
  });

  test("blank name falls back to 'Workout'; clock skew can't produce finish < start", () => {
    let d = templateDraft();
    const ex = d.exercises[0];
    d = { ...updateSet(d, ex.key, ex.sets[0].key, { weight: "100" }), name: "  " };
    d = toggleSetDone(d, ex.key, ex.sets[0].key).draft;
    const r = toSavePayload(d, new Date("2026-09-01T09:00:00Z"));
    if ("error" in r) throw new Error(r.error);
    expect(r.payload.name).toBe("Workout");
    expect(r.payload.finished_at).toBe(r.payload.started_at);
  });

  test("notes pass through unchanged when provided", () => {
    let d = templateDraft();
    const ex = d.exercises[0];
    d = updateSet(d, ex.key, ex.sets[0].key, { weight: "100" });
    d = toggleSetDone(d, ex.key, ex.sets[0].key).draft;
    const r = toSavePayload(d, new Date("2026-09-01T11:00:00Z"), "Felt strong today");
    if ("error" in r) throw new Error(r.error);
    expect(r.payload.notes).toBe("Felt strong today");
  });
});

describe("previous-session values", () => {
  const PREVIOUS: PreviousSet[] = [
    { weightKg: 61.235, reps: 5, rpe: null, isWarmup: true },
    { weightKg: 102.058, reps: 5, rpe: 8.5, isWarmup: false },
  ];

  test("setPreviousSets records what was fetched for an exercise", () => {
    let d = templateDraft();
    const ex = d.exercises[0];
    expect(ex.previous).toBeUndefined();
    d = setPreviousSets(d, ex.key, PREVIOUS);
    expect(d.exercises[0].previous).toEqual(PREVIOUS);
    d = setPreviousSets(d, ex.key, null);
    expect(d.exercises[0].previous).toBeNull();
  });

  test("summarizePreviousSets formats weight, warm-up and RPE", () => {
    expect(summarizePreviousSets(PREVIOUS, "lb")).toBe("135×5 (W), 225×5 @8.5");
    expect(summarizePreviousSets(PREVIOUS, "kg")).toBe("61.24×5 (W), 102.06×5 @8.5");
  });
});

describe("editing a saved workout", () => {
  test("editDraftFromWorkout converts saved sets to a draft, all already logged", () => {
    const d = editDraftFromWorkout(
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Push Day",
        startedAt: "2026-09-01T10:00:00.000Z",
        finishedAt: "2026-09-01T11:00:00.000Z",
        notes: "Good session",
        exercises: [
          {
            exerciseId: BENCH,
            name: "Barbell Bench Press",
            sets: [
              { weightKg: 61.235, reps: 5, rpe: null, isWarmup: true },
              { weightKg: 102.058, reps: 5, rpe: 8.5, isWarmup: false },
            ],
          },
        ],
      },
      "lb",
    );
    expect(d.id).toBe("44444444-4444-4444-8444-444444444444");
    expect(d.name).toBe("Push Day");
    expect(d.startedAt).toBe("2026-09-01T10:00:00.000Z");
    expect(d.exercises[0].sets.map((s) => [s.weight, s.reps, s.rpe, s.isWarmup, s.done])).toEqual([
      ["135", "5", null, true, true],
      ["225", "5", 8.5, false, true],
    ]);
  });

  test("round-trips back to the same payload via toSavePayload", () => {
    const d = editDraftFromWorkout(
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Push Day",
        startedAt: "2026-09-01T10:00:00.000Z",
        finishedAt: "2026-09-01T11:00:00.000Z",
        notes: null,
        exercises: [
          {
            exerciseId: BENCH,
            name: "Barbell Bench Press",
            sets: [{ weightKg: 102.058, reps: 5, rpe: null, isWarmup: false }],
          },
        ],
      },
      "lb",
    );
    const r = toSavePayload(d, new Date("2026-09-01T11:00:00.000Z"));
    if ("error" in r) throw new Error(r.error);
    expect(r.payload.exercises).toEqual([
      { exercise_id: BENCH, notes: null, sets: [{ weight_kg: 102.058, reps: 5, rpe: null, is_warmup: false }] },
    ]);
  });

  test("unchecking a set removes it when saved; deleting all sets blocks saving", () => {
    let d = editDraftFromWorkout(
      {
        id: "44444444-4444-4444-8444-444444444444",
        name: "Push Day",
        startedAt: "2026-09-01T10:00:00.000Z",
        finishedAt: "2026-09-01T11:00:00.000Z",
        notes: null,
        exercises: [
          {
            exerciseId: BENCH,
            name: "Barbell Bench Press",
            sets: [{ weightKg: 102.058, reps: 5, rpe: null, isWarmup: false }],
          },
        ],
      },
      "lb",
    );
    const ex = d.exercises[0];
    d = toggleSetDone(d, ex.key, ex.sets[0].key).draft;
    expect(countSets(d)).toEqual({ logged: 0, unlogged: 1 });
    expect(toSavePayload(d, new Date("2026-09-01T11:00:00Z"))).toEqual({
      error: "Log at least one set before finishing",
    });
  });
});
