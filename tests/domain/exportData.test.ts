import { describe, expect, test } from "vitest";
import { toSetsCsv, type ExportData } from "@/lib/client/exportData";

function data(overrides: Partial<ExportData> = {}): ExportData {
  return {
    exportedAt: "2026-09-01T00:00:00Z",
    weightUnit: "kg",
    workouts: [],
    templates: [],
    exercises: [],
    ...overrides,
  };
}

describe("CSV export (one row per logged set)", () => {
  test("header row and column order", () => {
    const csv = toSetsCsv(data());
    expect(csv).toBe("workout_date,workout_name,exercise_name,set_number,is_warmup,weight_kg,reps,rpe");
  });

  test("one row per set, numbered from 1, across exercises and workouts", () => {
    const csv = toSetsCsv(
      data({
        workouts: [
          {
            id: "w1",
            name: "Push Day",
            startedAt: "2026-09-01T14:00:00.000Z",
            finishedAt: "2026-09-01T15:00:00.000Z",
            notes: null,
            exercises: [
              {
                exerciseId: "e1",
                name: "Bench Press",
                notes: null,
                sets: [
                  { setNumber: 1, weightKg: 60, reps: 8, rpe: null, isWarmup: true },
                  { setNumber: 2, weightKg: 100, reps: 5, rpe: 8.5, isWarmup: false },
                ],
              },
            ],
          },
        ],
      }),
    );
    const rows = csv.split("\r\n");
    expect(rows).toHaveLength(3);
    expect(rows[1]).toBe("2026-09-01,Push Day,Bench Press,1,true,60,8,");
    expect(rows[2]).toBe("2026-09-01,Push Day,Bench Press,2,false,100,5,8.5");
  });

  test("fields containing commas or quotes are quoted and escaped", () => {
    const csv = toSetsCsv(
      data({
        workouts: [
          {
            id: "w1",
            name: 'Leg Day, "heavy"',
            startedAt: "2026-09-01T14:00:00.000Z",
            finishedAt: "2026-09-01T15:00:00.000Z",
            notes: null,
            exercises: [
              {
                exerciseId: "e1",
                name: "Squat",
                notes: null,
                sets: [{ setNumber: 1, weightKg: 100, reps: 5, rpe: null, isWarmup: false }],
              },
            ],
          },
        ],
      }),
    );
    expect(csv.split("\r\n")[1]).toBe('2026-09-01,"Leg Day, ""heavy""",Squat,1,false,100,5,');
  });

  test("no workouts: header only, not an error", () => {
    expect(toSetsCsv(data()).split("\r\n")).toEqual(["workout_date,workout_name,exercise_name,set_number,is_warmup,weight_kg,reps,rpe"]);
  });
});
