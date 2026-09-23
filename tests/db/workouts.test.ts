/**
 * Database tests run against the real migrations in an in-process Postgres.
 * Covers: saving workouts and sets, duplicate-save prevention, editing,
 * templates, custom exercises, new-user setup, and Row Level Security.
 */
import { beforeAll, describe, expect, test } from "vitest";
import { createDraft, toSavePayload, toggleSetDone, updateSet, type WorkoutDraft } from "@/lib/domain/draft";
import type { WorkoutPayload } from "@/lib/domain/schemas";
import { createDb, type Db } from "./harness";

let db: Db;
let alice: string;
let bob: string;

beforeAll(async () => {
  db = await createDb();
  alice = await db.createUser("alice@example.com");
  bob = await db.createUser("bob@example.com");
});

const idCache = new Map<string, string>();
async function exerciseId(user: string, name: string): Promise<string> {
  const cacheKey = `${user}:${name}`;
  if (!idCache.has(cacheKey)) {
    const r = await db.asUser(user, () =>
      db.query<{ id: string }>("select id from exercises where name = $1", [name]),
    );
    idCache.set(cacheKey, r.rows[0].id);
  }
  return idCache.get(cacheKey)!;
}

async function saveWorkout(user: string, payload: unknown) {
  const r = await db.asUser(user, () =>
    db.query<{ result: { id: string; duplicate: boolean } }>("select save_workout($1::jsonb) as result", [
      JSON.stringify(payload),
    ]),
  );
  return r.rows[0].result;
}

async function countRows(user: string, workoutId: string) {
  return db.asUser(user, async () => {
    const w = await db.query<{ n: number }>("select count(*)::int n from workouts where id = $1", [workoutId]);
    const e = await db.query<{ n: number }>("select count(*)::int n from workout_exercises where workout_id = $1", [
      workoutId,
    ]);
    const s = await db.query<{ n: number }>(
      "select count(*)::int n from workout_sets ws join workout_exercises we on we.id = ws.workout_exercise_id where we.workout_id = $1",
      [workoutId],
    );
    return { workouts: w.rows[0].n, exercises: e.rows[0].n, sets: s.rows[0].n };
  });
}

/** Builds a payload the same way the app does: draft -> log sets -> toSavePayload. */
async function buildPayload(user: string): Promise<WorkoutPayload> {
  const bench = await exerciseId(user, "Barbell Bench Press");
  const row = await exerciseId(user, "Barbell Row");
  let draft: WorkoutDraft = createDraft({
    name: "Push/Pull",
    templateId: null,
    unit: "lb",
    exercises: [
      { exerciseId: bench, name: "Barbell Bench Press", targetSets: 3, targetReps: 5 },
      { exerciseId: row, name: "Barbell Row", targetSets: 2, targetReps: 8 },
    ],
    now: new Date("2026-09-01T10:00:00Z"),
  });
  const [b, r] = draft.exercises;
  // Warm-up at 135, then 225 x5 x2 with RPE on the last one.
  draft = updateSet(draft, b.key, b.sets[0].key, { weight: "135", isWarmup: true });
  draft = toggleSetDone(draft, b.key, b.sets[0].key).draft;
  draft = updateSet(draft, b.key, b.sets[1].key, { weight: "225" });
  draft = toggleSetDone(draft, b.key, b.sets[1].key).draft;
  draft = updateSet(draft, b.key, b.sets[2].key, { rpe: 8.5 });
  draft = toggleSetDone(draft, b.key, b.sets[2].key).draft;
  draft = updateSet(draft, r.key, r.sets[0].key, { weight: "185" });
  draft = toggleSetDone(draft, r.key, r.sets[0].key).draft;
  // Row set 2 is never logged -> must not be saved.
  const result = toSavePayload(draft, new Date("2026-09-01T11:00:00Z"));
  if ("error" in result) throw new Error(result.error);
  return result.payload;
}

describe("new user setup", () => {
  test("creates a profile defaulting to lb and copies ~50 default exercises with muscles", async () => {
    await db.asUser(alice, async () => {
      const p = await db.query<{ weight_unit: string }>("select weight_unit from profiles");
      expect(p.rows).toEqual([{ weight_unit: "lb" }]);
      const e = await db.query<{ n: number }>("select count(*)::int n from exercises");
      expect(e.rows[0].n).toBeGreaterThanOrEqual(50);
      const noPrimary = await db.query<{ name: string }>(
        `select name from exercises e where not exists (
           select 1 from exercise_muscles m where m.exercise_id = e.id and m.role = 'primary')`,
      );
      expect(noPrimary.rows).toEqual([]);
    });
  });
});

describe("saving workouts", () => {
  test("saves the workout, its exercises and only the logged sets, in kg", async () => {
    const payload = await buildPayload(alice);
    const result = await saveWorkout(alice, payload);
    expect(result).toEqual({ id: payload.id, duplicate: false });

    expect(await countRows(alice, payload.id)).toEqual({ workouts: 1, exercises: 2, sets: 4 });

    const sets = await db.asUser(alice, () =>
      db.query<{ exercise_name: string; position: number; weight_kg: string; reps: number; rpe: string | null; is_warmup: boolean }>(
        `select we.exercise_name, ws.position, ws.weight_kg::text, ws.reps, ws.rpe::text, ws.is_warmup
           from workout_sets ws join workout_exercises we on we.id = ws.workout_exercise_id
          where we.workout_id = $1 order by we.position, ws.position`,
        [payload.id],
      ),
    );
    expect(sets.rows).toEqual([
      { exercise_name: "Barbell Bench Press", position: 0, weight_kg: "61.235", reps: 5, rpe: null, is_warmup: true },
      { exercise_name: "Barbell Bench Press", position: 1, weight_kg: "102.058", reps: 5, rpe: null, is_warmup: false },
      { exercise_name: "Barbell Bench Press", position: 2, weight_kg: "102.058", reps: 5, rpe: "8.5", is_warmup: false },
      { exercise_name: "Barbell Row", position: 0, weight_kg: "83.915", reps: 8, rpe: null, is_warmup: false },
    ]);
  });

  test("saving the same workout twice (double tap / retry) never creates a duplicate", async () => {
    const payload = await buildPayload(alice);
    const first = await saveWorkout(alice, payload);
    const second = await saveWorkout(alice, payload);
    const third = await saveWorkout(alice, payload);
    expect(first.duplicate).toBe(false);
    expect(second).toEqual({ id: payload.id, duplicate: true });
    expect(third.duplicate).toBe(true);
    expect(await countRows(alice, payload.id)).toEqual({ workouts: 1, exercises: 2, sets: 4 });
  });

  test("an invalid set rejects the whole workout (nothing partially saved)", async () => {
    const payload = await buildPayload(alice);
    const bad = structuredClone(payload);
    bad.exercises[1].sets[0].reps = -3;
    await expect(saveWorkout(alice, bad)).rejects.toThrow();
    expect(await countRows(alice, payload.id)).toEqual({ workouts: 0, exercises: 0, sets: 0 });
  });

  test.each([
    ["weight over 1000 kg", (p: WorkoutPayload) => (p.exercises[0].sets[0].weight_kg = 1001)],
    ["RPE not in 0.5 steps", (p: WorkoutPayload) => (p.exercises[0].sets[0].rpe = 7.3)],
    ["finish before start", (p: WorkoutPayload) => (p.finished_at = "2026-08-01T00:00:00Z")],
    ["exercise with no sets", (p: WorkoutPayload) => (p.exercises[0].sets = [])],
    ["no exercises", (p: WorkoutPayload) => (p.exercises = [])],
    ["blank name", (p: WorkoutPayload) => (p.name = "   ")],
  ])("database rejects %s", async (_label, mutate) => {
    const payload = await buildPayload(alice);
    mutate(payload);
    await expect(saveWorkout(alice, payload)).rejects.toThrow();
    expect((await countRows(alice, payload.id)).workouts).toBe(0);
  });

  test("reusing another user's workout id is an error, never a silent 'duplicate'", async () => {
    const payload = await buildPayload(alice);
    await saveWorkout(alice, payload);
    const bobPayload = await buildPayload(bob);
    bobPayload.id = payload.id;
    await expect(saveWorkout(bob, bobPayload)).rejects.toThrow(/already in use/);
  });

  test("a retry after a lost reply can apply later edits via update_workout", async () => {
    const payload = await buildPayload(alice);
    await saveWorkout(alice, payload); // reached the DB, but the phone never heard back
    const edited = structuredClone(payload);
    edited.exercises[0].sets[1].reps = 7;
    const retry = await saveWorkout(alice, edited);
    expect(retry.duplicate).toBe(true);
    await db.asUser(alice, () => db.query("select update_workout($1::jsonb)", [JSON.stringify(edited)]));
    const r = await db.asUser(alice, () =>
      db.query<{ reps: number }>(
        `select ws.reps from workout_sets ws join workout_exercises we on we.id = ws.workout_exercise_id
          where we.workout_id = $1 and we.position = 0 and ws.position = 1`,
        [payload.id],
      ),
    );
    expect(r.rows[0].reps).toBe(7);
    expect(await countRows(alice, payload.id)).toEqual({ workouts: 1, exercises: 2, sets: 4 });
  });

  test("a template deleted mid-workout doesn't block saving", async () => {
    const payload = await buildPayload(alice);
    payload.template_id = crypto.randomUUID();
    await saveWorkout(alice, payload);
    const r = await db.asUser(alice, () =>
      db.query<{ template_id: string | null }>("select template_id from workouts where id = $1", [payload.id]),
    );
    expect(r.rows[0].template_id).toBeNull();
  });

  test("signed-out callers cannot save", async () => {
    const payload = await buildPayload(alice);
    await db.exec("set role anon");
    try {
      await expect(
        db.query("select save_workout($1::jsonb)", [JSON.stringify(payload)]),
      ).rejects.toThrow();
    } finally {
      await db.exec("reset role");
    }
  });
});

describe("editing workouts", () => {
  test("update_workout replaces sets and keeps the original exercise-name snapshot", async () => {
    const payload = await buildPayload(alice);
    await saveWorkout(alice, payload);

    // Rename the exercise in the library after the workout was saved.
    const benchId = payload.exercises[0].exercise_id;
    await db.asUser(alice, () =>
      db.query("update exercises set name = 'Flat Bench (renamed)' where id = $1", [benchId]),
    );

    // Edit: drop the row exercise, change bench reps, add a set.
    const edited = structuredClone(payload);
    edited.name = "Push only";
    edited.exercises = [edited.exercises[0]];
    edited.exercises[0].sets[1].reps = 6;
    edited.exercises[0].sets.push({ weight_kg: 100, reps: 4, rpe: 9, is_warmup: false });

    await db.asUser(alice, () => db.query("select update_workout($1::jsonb)", [JSON.stringify(edited)]));

    expect(await countRows(alice, payload.id)).toEqual({ workouts: 1, exercises: 1, sets: 4 });
    const r = await db.asUser(alice, () =>
      db.query<{ name: string; exercise_name: string; reps: number[] }>(
        `select w.name, we.exercise_name, array_agg(ws.reps order by ws.position) reps
           from workouts w join workout_exercises we on we.workout_id = w.id
           join workout_sets ws on ws.workout_exercise_id = we.id
          where w.id = $1 group by w.name, we.exercise_name`,
        [payload.id],
      ),
    );
    expect(r.rows).toEqual([{ name: "Push only", exercise_name: "Barbell Bench Press", reps: [5, 6, 5, 4] }]);
  });

  test("a failed edit leaves the original workout untouched", async () => {
    const payload = await buildPayload(alice);
    await saveWorkout(alice, payload);
    const broken = structuredClone(payload);
    broken.exercises[0].sets[0].weight_kg = -1;
    await expect(
      db.asUser(alice, () => db.query("select update_workout($1::jsonb)", [JSON.stringify(broken)])),
    ).rejects.toThrow();
    expect(await countRows(alice, payload.id)).toEqual({ workouts: 1, exercises: 2, sets: 4 });
  });

  test("another user cannot edit or delete my workout", async () => {
    const payload = await buildPayload(alice);
    await saveWorkout(alice, payload);
    await expect(
      db.asUser(bob, () => db.query("select update_workout($1::jsonb)", [JSON.stringify(payload)])),
    ).rejects.toThrow(/not found/i);
    await db.asUser(bob, () => db.query("delete from workouts where id = $1", [payload.id]));
    expect((await countRows(alice, payload.id)).workouts).toBe(1);
  });

  test("deleting a workout removes its exercises and sets", async () => {
    const payload = await buildPayload(alice);
    await saveWorkout(alice, payload);
    await db.asUser(alice, () => db.query("delete from workouts where id = $1", [payload.id]));
    expect(await countRows(alice, payload.id)).toEqual({ workouts: 0, exercises: 0, sets: 0 });
  });

  test("exercises with history cannot be deleted (history stays intact)", async () => {
    const payload = await buildPayload(alice);
    await saveWorkout(alice, payload);
    await expect(
      db.asUser(alice, () => db.query("delete from exercises where id = $1", [payload.exercises[1].exercise_id])),
    ).rejects.toThrow();
  });
});

describe("row level security", () => {
  test("users only see their own data", async () => {
    await saveWorkout(alice, await buildPayload(alice));
    await db.asUser(bob, async () => {
      const w = await db.query<{ n: number }>("select count(*)::int n from workouts");
      expect(w.rows[0].n).toBe(0);
      const e = await db.query<{ n: number }>("select count(*)::int n from exercises where user_id <> $1", [bob]);
      expect(e.rows[0].n).toBe(0);
    });
  });

  test("a user cannot log a set against another user's exercise", async () => {
    const payload = await buildPayload(alice);
    const bobPayload = { ...payload, id: crypto.randomUUID() };
    await expect(saveWorkout(bob, bobPayload)).rejects.toThrow();
  });
});

describe("templates", () => {
  test("save_template creates, then updates (replacing the exercise list)", async () => {
    const bench = await exerciseId(alice, "Dumbbell Bench Press");
    const fly = await exerciseId(alice, "Dumbbell Fly");
    const id = await db.asUser(alice, async () => {
      const r = await db.query<{ id: string }>("select save_template($1::jsonb) as id", [
        JSON.stringify({
          id: null,
          name: "Chest A",
          notes: null,
          exercises: [
            { exercise_id: bench, target_sets: 4, target_reps: 8 },
            { exercise_id: fly, target_sets: null, target_reps: null },
          ],
        }),
      ]);
      return r.rows[0].id;
    });

    await db.asUser(alice, () =>
      db.query("select save_template($1::jsonb)", [
        JSON.stringify({
          id,
          name: "Chest A v2",
          notes: null,
          exercises: [{ exercise_id: fly, target_sets: 3, target_reps: 12 }],
        }),
      ]),
    );

    const rows = await db.asUser(alice, () =>
      db.query<{ name: string; exercise_id: string; target_sets: number }>(
        `select t.name, te.exercise_id, te.target_sets from templates t
           join template_exercises te on te.template_id = t.id where t.id = $1`,
        [id],
      ),
    );
    expect(rows.rows).toEqual([{ name: "Chest A v2", exercise_id: fly, target_sets: 3 }]);

    // Deleting the template leaves workouts started from it intact.
    const payload = await buildPayload(alice);
    payload.template_id = id;
    payload.name = "Chest A v2";
    await saveWorkout(alice, payload);
    await db.asUser(alice, () => db.query("delete from templates where id = $1", [id]));
    const w = await db.asUser(alice, () =>
      db.query<{ name: string; template_id: string | null }>("select name, template_id from workouts where id = $1", [
        payload.id,
      ]),
    );
    expect(w.rows).toEqual([{ name: "Chest A v2", template_id: null }]);
  });
});

describe("template create is idempotent", () => {
  test("saving a new template twice with the same client id creates one template", async () => {
    const fly = await exerciseId(alice, "Dumbbell Fly");
    const payload = { id: crypto.randomUUID(), name: "Retry me", notes: null, exercises: [{ exercise_id: fly, target_sets: 3, target_reps: 10 }] };
    for (let i = 0; i < 2; i++) {
      await db.asUser(alice, () => db.query("select save_template($1::jsonb)", [JSON.stringify(payload)]));
    }
    const r = await db.asUser(alice, () =>
      db.query<{ n: number; ex: number }>(
        "select count(*)::int n, (select count(*)::int from template_exercises where template_id = $1) ex from templates where name = 'Retry me'",
        [payload.id],
      ),
    );
    expect(r.rows[0]).toEqual({ n: 1, ex: 1 });
  });
});

describe("account deletion", () => {
  test("deleting a user with templates and workout history removes all their data", async () => {
    const carol = await db.createUser("carol@example.com");
    const payload = await buildPayload(carol);
    await saveWorkout(carol, payload);
    await db.asUser(carol, () =>
      db.query("select save_template($1::jsonb)", [
        JSON.stringify({ id: null, name: "C", notes: null, exercises: [{ exercise_id: payload.exercises[0].exercise_id, target_sets: 1, target_reps: 1 }] }),
      ]),
    );
    await db.query("delete from auth.users where id = $1", [carol]);
    const r = await db.query<{ n: number }>(
      `select (select count(*) from exercises where user_id = $1)
            + (select count(*) from workouts where user_id = $1)
            + (select count(*) from templates where user_id = $1)
            + (select count(*) from profiles where id = $1) as n`,
      [carol],
    );
    expect(Number(r.rows[0].n)).toBe(0);
  });
});

describe("previous exercise sets (Stage 2: previous-values display)", () => {
  test("returns only the most recent workout's sets per exercise, scoped to the caller", async () => {
    const bench = await exerciseId(alice, "Barbell Bench Press");
    const row = await exerciseId(alice, "Barbell Row");

    const first = await buildPayload(alice);
    await saveWorkout(alice, first);

    // A second, later bench session with different numbers.
    let draft: WorkoutDraft = createDraft({
      name: "Push 2",
      templateId: null,
      unit: "lb",
      exercises: [{ exerciseId: bench, name: "Barbell Bench Press", targetSets: 1, targetReps: 3 }],
      now: new Date("2026-09-03T10:00:00Z"),
    });
    const ex = draft.exercises[0];
    draft = updateSet(draft, ex.key, ex.sets[0].key, { weight: "235" });
    draft = toggleSetDone(draft, ex.key, ex.sets[0].key).draft;
    const second = toSavePayload(draft, new Date("2026-09-03T10:30:00Z"));
    if ("error" in second) throw new Error(second.error);
    await saveWorkout(alice, second.payload);

    const result = await db.asUser(alice, () =>
      db.query<{ exercise_id: string; sets: { weight_kg: number; reps: number; rpe: number | null; is_warmup: boolean }[] }>(
        "select exercise_id, sets from previous_exercise_sets($1::uuid[])",
        [[bench, row]],
      ),
    );
    const byExercise = Object.fromEntries(result.rows.map((r) => [r.exercise_id, r.sets]));
    // Bench: the later (second) session's single set, not the first session's three.
    expect(byExercise[bench]).toEqual([{ weight_kg: 106.594, reps: 3, rpe: null, is_warmup: false }]);
    // Row: only ever logged in the first session.
    expect(byExercise[row]).toEqual([{ weight_kg: 83.915, reps: 8, rpe: null, is_warmup: false }]);

    // Bob has never done these exercises.
    const bobResult = await db.asUser(bob, () =>
      db.query<{ exercise_id: string }>("select exercise_id from previous_exercise_sets($1::uuid[])", [[bench, row]]),
    );
    expect(bobResult.rows).toEqual([]);
  });
});

describe("custom exercises", () => {
  test("create_exercise stores the exercise and its muscles; duplicate names are rejected", async () => {
    const create = () =>
      db.asUser(alice, () =>
        db.query<{ id: string }>("select create_exercise($1::jsonb) as id", [
          JSON.stringify({ name: "Zercher Squat", equipment: "Barbell", primary: ["quads"], secondary: ["glutes", "quads"] }),
        ]),
      );
    const id = (await create()).rows[0].id;
    const m = await db.asUser(alice, () =>
      db.query<{ muscle_group_id: string; role: string }>(
        "select muscle_group_id, role from exercise_muscles where exercise_id = $1 order by role",
        [id],
      ),
    );
    expect(m.rows).toEqual([
      { muscle_group_id: "quads", role: "primary" },
      { muscle_group_id: "glutes", role: "secondary" },
    ]);
    await expect(create()).rejects.toThrow(/duplicate|unique/i);
  });
});
