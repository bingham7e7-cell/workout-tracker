"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { describeError, timeoutSignal } from "@/lib/client/errors";
import { exerciseInputSchema, firstIssue } from "@/lib/domain/schemas";

export type PickedExercise = { exerciseId: string; name: string };
type Exercise = { id: string; name: string; equipment: string | null };
type Muscle = { id: string; name: string };

const EQUIPMENT = ["Barbell", "Dumbbell", "Machine", "Cable", "Bodyweight", "EZ Bar", "Kettlebell", "Other"];

// Cached for the session so reopening the picker is instant.
let exerciseCache: Exercise[] | null = null;

async function fetchExercises(): Promise<Exercise[]> {
  const { data, error } = await getSupabaseBrowser()
    .from("exercises")
    .select("id, name, equipment")
    .is("archived_at", null)
    .order("name")
    .abortSignal(timeoutSignal());
  if (error) throw error;
  exerciseCache = data;
  return data;
}

/** Full-screen, searchable exercise list with "create new exercise". */
export function ExercisePicker({ onPick, onClose }: { onPick: (e: PickedExercise) => void; onClose: () => void }) {
  const [exercises, setExercises] = useState<Exercise[] | null>(exerciseCache);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  function load() {
    fetchExercises().then(
      (data) => {
        setError(null);
        setExercises(data);
      },
      (e) => setError(describeError(e)),
    );
  }

  useEffect(() => {
    if (!exerciseCache) load();
  }, []);

  const filtered = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return (exercises ?? []).filter((e) => {
      const hay = `${e.name} ${e.equipment ?? ""}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [exercises, query]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-zinc-950 pt-safe">
      <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 py-3">
        <input
          type="search"
          placeholder="Search exercises"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-12 min-w-0 flex-1 rounded-xl bg-zinc-900 px-4 outline-none ring-1 ring-zinc-800 focus:ring-emerald-500"
        />
        <button onClick={onClose} className="h-12 px-3 text-emerald-400">
          Cancel
        </button>
      </div>

      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 pb-safe">
        {creating ? (
          <CreateExerciseForm
            initialName={query}
            onCancel={() => setCreating(false)}
            onCreated={(e) => {
              exerciseCache = null;
              onPick(e);
            }}
          />
        ) : (
          <>
            {error && (
              <div className="mb-3 rounded-lg bg-red-950 p-3 text-red-200">
                {error}{" "}
                <button onClick={load} className="underline">
                  Retry
                </button>
              </div>
            )}
            {!exercises && !error && <p className="py-6 text-center text-zinc-400">Loading…</p>}
            <ul className="divide-y divide-zinc-900">
              {filtered.map((e) => (
                <li key={e.id}>
                  <button
                    onClick={() => onPick({ exerciseId: e.id, name: e.name })}
                    className="flex min-h-14 w-full items-center justify-between py-3 text-left active:bg-zinc-900"
                  >
                    <span className="font-medium">{e.name}</span>
                    {e.equipment && <span className="text-sm text-zinc-500">{e.equipment}</span>}
                  </button>
                </li>
              ))}
            </ul>
            {exercises && (
              <button
                onClick={() => setCreating(true)}
                className="my-4 h-14 w-full rounded-xl border border-dashed border-zinc-700 text-emerald-400"
              >
                + Create {query.trim() ? `“${query.trim()}”` : "new exercise"}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CreateExerciseForm({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  onCreated: (e: PickedExercise) => void;
}) {
  const [name, setName] = useState(initialName.trim());
  const [equipment, setEquipment] = useState<string>("");
  const [muscles, setMuscles] = useState<Muscle[] | null>(null);
  const [roles, setRoles] = useState<Record<string, "primary" | "secondary">>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSupabaseBrowser()
      .from("muscle_groups")
      .select("id, name")
      .order("sort_order")
      .abortSignal(timeoutSignal())
      .then(({ data, error }) => (error ? setError(describeError(error)) : setMuscles(data)));
  }, []);

  // Tap cycles: none → primary → secondary → none.
  function cycle(id: string) {
    setRoles((r) => {
      const next = { ...r };
      if (!r[id]) next[id] = "primary";
      else if (r[id] === "primary") next[id] = "secondary";
      else delete next[id];
      return next;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const input = {
      name,
      equipment: equipment || null,
      primary: Object.keys(roles).filter((k) => roles[k] === "primary"),
      secondary: Object.keys(roles).filter((k) => roles[k] === "secondary"),
    };
    const parsed = exerciseInputSchema.safeParse(input);
    if (!parsed.success) return setError(firstIssue(parsed.error));

    setBusy(true);
    setError(null);
    const { data, error } = await getSupabaseBrowser()
      .rpc("create_exercise", { p_exercise: parsed.data })
      .abortSignal(timeoutSignal());
    setBusy(false);
    if (error) {
      setError(error.code === "23505" ? "You already have an exercise with that name." : describeError(error));
      return;
    }
    onCreated({ exerciseId: data as string, name: parsed.data.name });
  }

  return (
    <form onSubmit={submit} className="space-y-4 py-2">
      <h2 className="text-lg font-semibold">New exercise</h2>
      <input
        placeholder="Name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={100}
        className="h-12 w-full rounded-xl bg-zinc-900 px-4 outline-none ring-1 ring-zinc-800 focus:ring-emerald-500"
      />
      <select
        value={equipment}
        onChange={(e) => setEquipment(e.target.value)}
        className="h-12 w-full rounded-xl bg-zinc-900 px-4 outline-none ring-1 ring-zinc-800"
      >
        <option value="">Equipment (optional)</option>
        {EQUIPMENT.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <div>
        <p className="mb-2 text-sm text-zinc-400">
          Muscles — tap once for <span className="text-emerald-400">primary</span>, twice for{" "}
          <span className="text-sky-400">secondary</span>.
        </p>
        <div className="flex flex-wrap gap-2">
          {muscles?.map((m) => (
            <button
              type="button"
              key={m.id}
              onClick={() => cycle(m.id)}
              className={`h-11 rounded-full px-4 text-sm ${
                roles[m.id] === "primary"
                  ? "bg-emerald-500 text-zinc-950"
                  : roles[m.id] === "secondary"
                    ? "bg-sky-500 text-zinc-950"
                    : "bg-zinc-800"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>
      {error && <p className="rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="h-12 flex-1 rounded-xl bg-zinc-800">
          Back
        </button>
        <button disabled={busy} className="h-12 flex-1 rounded-xl bg-emerald-500 font-semibold text-zinc-950 disabled:opacity-50">
          {busy ? "Saving…" : "Create"}
        </button>
      </div>
    </form>
  );
}
