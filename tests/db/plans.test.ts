/**
 * Plan advancing and skipping (item 2 of the plans feature). Covers:
 * finishing the workout a plan suggests advances it and loops at the end,
 * finishing a different workout leaves it alone, skip moves the position
 * without touching the plan's contents, and a plan can't be pointed at by
 * another user.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { createDraft, toSavePayload, toggleSetDone, updateSet, type WorkoutDraft } from "@/lib/domain/draft";
import { createDb, type Db } from "./harness";

let db: Db;
let alice: string;
let bob: string;

beforeAll(async () => {
  db = await createDb();
  alice = await db.createUser("alice@example.com");
  bob = await db.createUser("bob@example.com");
});

async function exerciseId(user: string, name: string): Promise<string> {
  const r = await db.asUser(user, () => db.query<{ id: string }>("select id from exercises where name = $1", [name]));
  return r.rows[0].id;
}

async function makeTemplate(user: string, name: string, exerciseName: string): Promise<string> {
  const exId = await exerciseId(user, exerciseName);
  const r = await db.asUser(user, () =>
    db.query<{ id: string }>("select save_template($1::jsonb) as id", [
      JSON.stringify({ id: null, name, notes: null, exercises: [{ exercise_id: exId, target_sets: 3, target_reps: 5 }] }),
    ]),
  );
  return r.rows[0].id;
}

async function makePlan(user: string, name: string, templateIds: string[]): Promise<string> {
  const r = await db.asUser(user, () =>
    db.query<{ id: string }>("select save_plan($1::jsonb) as id", [
      JSON.stringify({ id: null, name, template_ids: templateIds }),
    ]),
  );
  return r.rows[0].id;
}

async function setActivePlan(user: string, planId: string) {
  await db.asUser(user, () => db.query("update profiles set active_plan_id = $1 where id = $2", [planId, user]));
}

async function activePosition(user: string): Promise<number> {
  const r = await db.asUser(user, () =>
    db.query<{ active_plan_position: number }>("select active_plan_position from profiles where id = $1", [user]),
  );
  return r.rows[0].active_plan_position;
}

/** The template the plan currently suggests, by RANK (not raw position) — same logic as getActivePlanNext. */
async function effectiveNextTemplate(user: string, planId: string): Promise<string> {
  const r = await db.asUser(user, () =>
    db.query<{ template_id: string }>(
      `select template_id from plan_workouts where plan_id = $1 order by position
       offset (select active_plan_position from profiles where id = $2) % (select count(*) from plan_workouts where plan_id = $1)
       limit 1`,
      [planId, user],
    ),
  );
  return r.rows[0].template_id;
}

/** Builds and saves a minimal finished workout for `templateId` (or none, if null). */
async function finishWorkout(user: string, templateId: string | null, exerciseName: string, exerciseId_: string) {
  let draft: WorkoutDraft = createDraft({
    name: "Workout",
    templateId,
    unit: "lb",
    exercises: [{ exerciseId: exerciseId_, name: exerciseName, targetSets: 1, targetReps: 5 }],
    now: new Date("2026-09-01T10:00:00Z"),
  });
  const ex = draft.exercises[0];
  draft = updateSet(draft, ex.key, ex.sets[0].key, { weight: "100" });
  draft = toggleSetDone(draft, ex.key, ex.sets[0].key).draft;
  const built = toSavePayload(draft, new Date("2026-09-01T10:30:00Z"));
  if ("error" in built) throw new Error(built.error);
  await db.asUser(user, () => db.query("select save_workout($1::jsonb)", [JSON.stringify(built.payload)]));
}

describe("plan advancing", () => {
  test("finishing the suggested workout advances the plan and loops at the end", async () => {
    const push = await makeTemplate(alice, "Push", "Barbell Bench Press");
    const pull = await makeTemplate(alice, "Pull", "Barbell Row");
    const legs = await makeTemplate(alice, "Legs", "Back Squat");
    const plan = await makePlan(alice, "PPL", [push, pull, legs]);
    await setActivePlan(alice, plan);
    expect(await activePosition(alice)).toBe(0);

    const bench = await exerciseId(alice, "Barbell Bench Press");
    await finishWorkout(alice, push, "Barbell Bench Press", bench);
    expect(await activePosition(alice)).toBe(1);

    const row = await exerciseId(alice, "Barbell Row");
    await finishWorkout(alice, pull, "Barbell Row", row);
    expect(await activePosition(alice)).toBe(2);

    const squat = await exerciseId(alice, "Back Squat");
    await finishWorkout(alice, legs, "Back Squat", squat);
    expect(await activePosition(alice)).toBe(0); // loops back to the start
  });

  test("finishing a different workout than the one suggested leaves the plan where it is", async () => {
    const push = await makeTemplate(alice, "Push B", "Barbell Bench Press");
    const pull = await makeTemplate(alice, "Pull B", "Barbell Row");
    const plan = await makePlan(alice, "PP", [push, pull]);
    await setActivePlan(alice, plan);
    expect(await activePosition(alice)).toBe(0);

    // The plan suggests Push (position 0); finish an unrelated blank workout instead.
    const squat = await exerciseId(alice, "Back Squat");
    await finishWorkout(alice, null, "Back Squat", squat);
    expect(await activePosition(alice)).toBe(0);

    // Finishing Pull (not the suggested Push) also leaves it at 0.
    const row = await exerciseId(alice, "Barbell Row");
    await finishWorkout(alice, pull, "Barbell Row", row);
    expect(await activePosition(alice)).toBe(0);
  });

  test("a user with no active plan can finish workouts with no effect on any plan state", async () => {
    const bench = await exerciseId(alice, "Barbell Bench Press");
    await db.asUser(alice, () => db.query("update profiles set active_plan_id = null where id = $1", [alice]));
    await expect(finishWorkout(alice, null, "Barbell Bench Press", bench)).resolves.not.toThrow();
  });

  test("deleting a mid-plan template (leaving a gap in position) doesn't strand the plan", async () => {
    const a = await makeTemplate(alice, "Gap A", "Barbell Bench Press");
    const b = await makeTemplate(alice, "Gap B", "Barbell Row");
    const c = await makeTemplate(alice, "Gap C", "Back Squat");
    const d = await makeTemplate(alice, "Gap D", "Overhead Press");
    const plan = await makePlan(alice, "Gap plan", [a, b, c, d]);
    await setActivePlan(alice, plan);

    // Advance to position 2 (pointing at C).
    await finishWorkout(alice, a, "Barbell Bench Press", await exerciseId(alice, "Barbell Bench Press"));
    await finishWorkout(alice, b, "Barbell Row", await exerciseId(alice, "Barbell Row"));
    expect(await activePosition(alice)).toBe(2);

    // Delete C: its plan_workouts row cascades away, leaving positions 0,1,3 (a gap at 2).
    await db.asUser(alice, () => db.query("delete from templates where id = $1", [c]));
    expect(await effectiveNextTemplate(alice, plan)).toBe(d); // rank 2 of [A,B,D] is D, not stuck on the deleted C

    // Finishing what the plan now suggests (D) must still advance it, looping back to A.
    await finishWorkout(alice, d, "Overhead Press", await exerciseId(alice, "Overhead Press"));
    expect(await effectiveNextTemplate(alice, plan)).toBe(a);
  });

  test("shrinking the active plan below the current position doesn't strand it", async () => {
    const a = await makeTemplate(alice, "Shrink A", "Barbell Bench Press");
    const b = await makeTemplate(alice, "Shrink B", "Barbell Row");
    const c = await makeTemplate(alice, "Shrink C", "Back Squat");
    const d = await makeTemplate(alice, "Shrink D", "Overhead Press");
    const plan = await makePlan(alice, "Shrink plan", [a, b, c, d]);
    await setActivePlan(alice, plan);
    await db.asUser(alice, () => db.query("update profiles set active_plan_position = 3 where id = $1", [alice]));

    // Edit the plan down to just [A, B] — active_plan_position (3) is now out of the raw range.
    await db.asUser(alice, () =>
      db.query("select save_plan($1::jsonb)", [JSON.stringify({ id: plan, name: "Shrink plan", template_ids: [a, b] })]),
    );
    expect(await effectiveNextTemplate(alice, plan)).toBe(b); // rank 3 % 2 = 1 -> B, not stuck

    await finishWorkout(alice, b, "Barbell Row", await exerciseId(alice, "Barbell Row"));
    expect(await effectiveNextTemplate(alice, plan)).toBe(a); // advanced to rank (1+1)%2=0 -> A
  });
});

describe("skipping a plan", () => {
  test("moves to the next workout without deleting anything from the plan", async () => {
    const a = await makeTemplate(alice, "Skip A", "Barbell Bench Press");
    const b = await makeTemplate(alice, "Skip B", "Barbell Row");
    const plan = await makePlan(alice, "Skip plan", [a, b]);
    await setActivePlan(alice, plan);

    await db.asUser(alice, () => db.query("select skip_active_plan()"));
    expect(await activePosition(alice)).toBe(1);

    await db.asUser(alice, () => db.query("select skip_active_plan()"));
    expect(await activePosition(alice)).toBe(0); // loops back

    const rows = await db.asUser(alice, () =>
      db.query<{ n: number }>("select count(*)::int n from plan_workouts where plan_id = $1", [plan]),
    );
    expect(rows.rows[0].n).toBe(2);
  });

  test("skipping with no active plan does nothing and does not error", async () => {
    await db.asUser(alice, () => db.query("update profiles set active_plan_id = null where id = $1", [alice]));
    await expect(db.asUser(alice, () => db.query("select skip_active_plan()"))).resolves.not.toThrow();
    expect(await activePosition(alice)).toBe(0);
  });
});

describe("plan ownership", () => {
  test("a user cannot set another user's plan as their active plan", async () => {
    const t = await makeTemplate(alice, "Alice Only", "Barbell Bench Press");
    const plan = await makePlan(alice, "Alice's plan", [t]);
    await expect(
      db.asUser(bob, () => db.query("update profiles set active_plan_id = $1 where id = $2", [plan, bob])),
    ).rejects.toThrow(/not your plan/i);
  });

  test("switching the active plan resets the position to 0", async () => {
    const a = await makeTemplate(bob, "Bob A", "Barbell Bench Press");
    const b = await makeTemplate(bob, "Bob B", "Barbell Row");
    const planOne = await makePlan(bob, "Bob plan one", [a, b]);
    const planTwo = await makePlan(bob, "Bob plan two", [b, a]);
    await setActivePlan(bob, planOne);
    await db.asUser(bob, () => db.query("select skip_active_plan()"));
    expect(await activePosition(bob)).toBe(1);

    await setActivePlan(bob, planTwo);
    expect(await activePosition(bob)).toBe(0);
  });

  test("a user only sees their own plans", async () => {
    await db.asUser(bob, async () => {
      const r = await db.query<{ n: number }>("select count(*)::int n from plans where user_id <> $1", [bob]);
      expect(r.rows[0].n).toBe(0);
    });
  });
});
