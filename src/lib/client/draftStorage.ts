/**
 * Keeps the active workout on this device (localStorage) so a refresh,
 * closed tab or lost connection never loses logged sets. Browser-only.
 *
 * The stored copy is the single source of truth for the workout screen:
 * every change is written here first, then the screen re-renders from it.
 * An in-memory copy is kept too, so the app still works for the current
 * session if the phone refuses to store data (e.g. storage full).
 */
"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { WorkoutDraft } from "@/lib/domain/draft";

const KEY = "workout-tracker.active-workout.v1";
const listeners = new Set<() => void>();
let memory: string | null | undefined; // undefined = not read yet

function readRaw(): string | null {
  if (memory === undefined) {
    try {
      memory = localStorage.getItem(KEY);
    } catch {
      memory = null;
    }
  }
  return memory;
}

function notify() {
  listeners.forEach((l) => l());
}

export function parseDraft(raw: string | null): WorkoutDraft | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1 || typeof parsed.id !== "string" || !Array.isArray(parsed.exercises)) return null;
    return parsed as WorkoutDraft;
  } catch {
    return null;
  }
}

export function loadDraft(): WorkoutDraft | null {
  return parseDraft(readRaw());
}

/** Returns false if the phone refused to store it (kept in memory only). */
export function saveDraft(draft: WorkoutDraft): boolean {
  memory = JSON.stringify(draft);
  let persisted = true;
  try {
    localStorage.setItem(KEY, memory);
  } catch {
    persisted = false;
  }
  notify();
  return persisted;
}

export function clearDraft(): void {
  memory = null;
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Nothing else we can do.
  }
  notify();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      memory = e.newValue;
      listener();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/**
 * The active workout, kept in sync with storage.
 * `ready` is false during the first (server) render, before storage is read.
 */
export function useActiveDraft(): { draft: WorkoutDraft | null; ready: boolean } {
  const raw = useSyncExternalStore(subscribe, readRaw, () => undefined as unknown as string | null);
  const ready = raw !== undefined;
  const draft = useMemo(() => (ready ? parseDraft(raw) : null), [raw, ready]);
  return { draft, ready };
}
