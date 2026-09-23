/**
 * AI plan import: the transactional import_plan RPC. Covers saving a mix of
 * matched (existing) and new exercises together, tagging new exercises
 * "Added by import" (added_via), and that a failure never leaves a
 * half-imported plan behind.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { createDb, type Db } from "./harness";

let db: Db;
let alice: string;

beforeAll(async () => {
  db = await createDb();
  alice = await db.createUser("alice@example.com");
});

async function exerciseId(name: string): Promise<string> {
  const r = await db.asUser(alice, () => db.query<{ id: string }>("select id from exercises where name = $1", [name]));
  return r.rows[0].id;
}

async function importPlan(payload: unknown) {
  return db.asUser(alice, () => db.query<{ id: string }>("select import_plan($1::jsonb) as id", [JSON.stringify(payload)]));
}

describe("import_plan", () => {
  test("saves matched and new exercises, the templates, and the plan in one transaction", async () => {
    const bench = await exerciseId("Barbell Bench Press");
    const payload = {
      plan_name: "Imported Push/Pull",
      workouts: [
        {
          name: "Push",
          exercises: [
            { kind: "matched", exercise_id: bench, sets: 4, reps: 7 },
            { kind: "new", name: "Cable Y-Raise", primary: ["shoulders_rear"], secondary: ["trapezius"], sets: 3, reps: 14 },
          ],
        },
      ],
    };
    const result = await importPlan(payload);
    const planId = result.rows[0].id;
    expect(planId).toBeTruthy();

    const workouts = await db.asUser(alice, () =>
      db.query<{ name: string; exercise_name: string; target_sets: number; target_reps: number }>(
        `select t.name, e.name as exercise_name, te.target_sets, te.target_reps
           from plan_workouts pw
           join templates t on t.id = pw.template_id
           join template_exercises te on te.template_id = t.id
           join exercises e on e.id = te.exercise_id
          where pw.plan_id = $1 order by te.position`,
        [planId],
      ),
    );
    expect(workouts.rows).toEqual([
      { name: "Push", exercise_name: "Barbell Bench Press", target_sets: 4, target_reps: 7 },
      { name: "Push", exercise_name: "Cable Y-Raise", target_sets: 3, target_reps: 14 },
    ]);

    const newExercise = await db.asUser(alice, () =>
      db.query<{ added_via: string | null }>("select added_via from exercises where name = 'Cable Y-Raise'"),
    );
    expect(newExercise.rows[0].added_via).toBe("import");

    const muscles = await db.asUser(alice, () =>
      db.query<{ muscle_group_id: string; role: string }>(
        `select muscle_group_id, role from exercise_muscles em
           join exercises e on e.id = em.exercise_id where e.name = 'Cable Y-Raise' order by role`,
      ),
    );
    expect(muscles.rows).toEqual([
      { muscle_group_id: "shoulders_rear", role: "primary" },
      { muscle_group_id: "trapezius", role: "secondary" },
    ]);
  });

  test("a new exercise with no primary muscle rolls back the whole import (no half-imported plan)", async () => {
    const before = await db.asUser(alice, () => db.query<{ n: number }>("select count(*)::int n from plans"));
    const payload = {
      plan_name: "Should not be saved",
      workouts: [{ name: "Day 1", exercises: [{ kind: "new", name: "Bad Exercise", primary: [], secondary: [], sets: 3, reps: 10 }] }],
    };
    await expect(importPlan(payload)).rejects.toThrow(/primary muscle/i);
    const after = await db.asUser(alice, () => db.query<{ n: number }>("select count(*)::int n from plans"));
    expect(after.rows[0].n).toBe(before.rows[0].n);
    const orphanExercise = await db.asUser(alice, () => db.query<{ n: number }>("select count(*)::int n from exercises where name = 'Bad Exercise'"));
    expect(orphanExercise.rows[0].n).toBe(0);
  });

  test("a duplicate new exercise name is rejected and rolls back", async () => {
    const before = await db.asUser(alice, () => db.query<{ n: number }>("select count(*)::int n from plans"));
    const payload = {
      plan_name: "Duplicate name",
      workouts: [
        { name: "Day 1", exercises: [{ kind: "new", name: "Barbell Bench Press", primary: ["chest"], secondary: [], sets: 3, reps: 10 }] },
      ],
    };
    await expect(importPlan(payload)).rejects.toThrow();
    const after = await db.asUser(alice, () => db.query<{ n: number }>("select count(*)::int n from plans"));
    expect(after.rows[0].n).toBe(before.rows[0].n);
  });

  test("a plan with no workouts is rejected", async () => {
    await expect(importPlan({ plan_name: "Empty", workouts: [] })).rejects.toThrow(/at least one workout/i);
  });

  test("signed-out callers cannot import", async () => {
    const payload = { plan_name: "X", workouts: [{ name: "Day 1", exercises: [{ kind: "new", name: "Whatever", primary: ["chest"], secondary: [], sets: 3, reps: 10 }] }] };
    await db.exec("set role anon");
    try {
      await expect(db.query("select import_plan($1::jsonb)", [JSON.stringify(payload)])).rejects.toThrow();
    } finally {
      await db.exec("reset role");
    }
  });
});
