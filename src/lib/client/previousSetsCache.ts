/**
 * On-device copy of "last time you did this exercise" (Stage 2's previous_exercise_sets
 * RPC), so a workout can be started and logged with no signal after at least one
 * successful sync. Browser-only, best-effort (never blocks or throws).
 */
"use client";

import type { PreviousSet } from "@/lib/domain/draft";

const KEY = "workout-tracker.previous-sets.v1";

type Cache = Record<string, PreviousSet[] | null>;

function readCache(): Cache {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Cache) : {};
  } catch {
    return {};
  }
}

function writeCache(cache: Cache) {
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // Not critical: previous-values just won't be available offline this time.
  }
}

/** `undefined` = never cached; `null` = cached "no history yet". */
export function getCachedPreviousSets(exerciseId: string): PreviousSet[] | null | undefined {
  const cache = readCache();
  return Object.prototype.hasOwnProperty.call(cache, exerciseId) ? cache[exerciseId] : undefined;
}

export function setCachedPreviousSets(exerciseId: string, sets: PreviousSet[] | null): void {
  const cache = readCache();
  cache[exerciseId] = sets;
  writeCache(cache);
}

export function clearPreviousSetsCache(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing else we can do.
  }
}
