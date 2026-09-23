/**
 * On-device copy of the signed-in user's exercise library, so the exercise
 * picker still works (and workouts can add exercises) with no signal, after
 * at least one successful load. Browser-only, best-effort (never blocks or throws).
 */
"use client";

export type CachedExercise = { id: string; name: string; equipment: string | null };

const KEY = "workout-tracker.exercise-library.v1";

export function readOfflineExercises(): CachedExercise[] | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CachedExercise[]) : null;
  } catch {
    return null;
  }
}

export function writeOfflineExercises(exercises: CachedExercise[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(exercises));
  } catch {
    // Not critical: the in-memory cache still works for this session.
  }
}

export function clearOfflineExercises(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing else we can do.
  }
}
