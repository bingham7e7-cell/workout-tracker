"use client";

import { useState } from "react";
import { parseNumber, type DraftSet } from "@/lib/domain/draft";
import { weightStep, type WeightUnit } from "@/lib/domain/units";

const RPE_OPTIONS = [6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10];

type Props = {
  set: DraftSet;
  /** Working-set number (1, 2, 3…); warm-ups show "W". */
  label: string;
  unit: WeightUnit;
  error?: string;
  onChange: (patch: Partial<Omit<DraftSet, "key">>) => void;
  onToggleDone: () => void;
  onRemove: () => void;
};

const selectAll = (e: React.FocusEvent<HTMLInputElement>) => e.currentTarget.select();

/**
 * One set: [set # / W] [weight] [reps] [⋯] [✓]
 * Tap the set number to mark a warm-up. "⋯" opens RPE, ± weight and delete.
 */
export function SetRow({ set, label, unit, error, onChange, onToggleDone, onRemove }: Props) {
  const [open, setOpen] = useState(false);
  const step = weightStep(unit);

  function bump(delta: number) {
    const next = Math.max(0, (parseNumber(set.weight) ?? 0) + delta);
    onChange({ weight: String(Math.round(next * 100) / 100) });
  }

  const inputClass = `h-12 w-full min-w-0 rounded-lg text-center text-lg font-semibold outline-none focus:ring-2 focus:ring-emerald-500 ${
    set.done ? "bg-emerald-950 text-emerald-100" : "bg-zinc-800"
  }`;

  return (
    <div className={`rounded-xl px-1 py-1 ${set.done ? "bg-emerald-500/10" : ""}`}>
      <div className="grid grid-cols-[2.75rem_1fr_1fr_2.75rem_3.5rem] items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ isWarmup: !set.isWarmup })}
          aria-label={set.isWarmup ? "Warm-up set (tap to make it a working set)" : "Working set (tap to mark as warm-up)"}
          className={`h-12 rounded-lg text-base font-bold ${set.isWarmup ? "bg-amber-500/20 text-amber-400" : "text-zinc-400"}`}
        >
          {label}
        </button>
        <input
          aria-label={`Weight (${unit})`}
          inputMode="decimal"
          autoComplete="off"
          placeholder={unit}
          value={set.weight}
          onFocus={selectAll}
          onChange={(e) => onChange({ weight: e.target.value.replace(/[^\d.,]/g, "") })}
          className={inputClass}
        />
        <input
          aria-label="Reps"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          placeholder="reps"
          value={set.reps}
          onFocus={selectAll}
          onChange={(e) => onChange({ reps: e.target.value.replace(/\D/g, "") })}
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="More options: RPE, adjust weight, delete"
          aria-expanded={open}
          className={`h-12 rounded-lg text-sm font-semibold ${set.rpe != null ? "text-sky-400" : "text-zinc-400"} ${open ? "bg-zinc-800" : ""}`}
        >
          {set.rpe != null ? `@${set.rpe}` : "•••"}
        </button>
        <button
          type="button"
          onClick={onToggleDone}
          aria-label={set.done ? "Logged (tap to undo)" : "Log set"}
          aria-pressed={set.done}
          className={`h-12 rounded-lg text-2xl font-bold ${
            set.done ? "bg-emerald-500 text-zinc-950" : "bg-zinc-800 text-zinc-500 active:bg-zinc-700"
          }`}
        >
          ✓
        </button>
      </div>

      {error && <p className="px-1 pt-1 text-sm text-red-400">{error}</p>}

      {open && (
        <div className="mt-2 space-y-3 rounded-xl bg-zinc-900 p-3">
          <div className="flex items-center gap-2">
            <span className="w-14 text-sm text-zinc-400">Weight</span>
            <button type="button" onClick={() => bump(-step)} className="h-11 flex-1 rounded-lg bg-zinc-800 font-semibold">
              −{step}
            </button>
            <button type="button" onClick={() => bump(step)} className="h-11 flex-1 rounded-lg bg-zinc-800 font-semibold">
              +{step}
            </button>
          </div>
          <div>
            <div className="mb-1 text-sm text-zinc-400">RPE (effort, optional — 10 = nothing left)</div>
            <div className="grid grid-cols-5 gap-2">
              {RPE_OPTIONS.map((r) => (
                <button
                  type="button"
                  key={r}
                  onClick={() => onChange({ rpe: set.rpe === r ? null : r })}
                  className={`h-11 rounded-lg text-sm font-semibold ${set.rpe === r ? "bg-sky-500 text-zinc-950" : "bg-zinc-800"}`}
                >
                  {r}
                </button>
              ))}
              <button
                type="button"
                onClick={() => onChange({ rpe: null })}
                className="h-11 rounded-lg bg-zinc-800 text-sm text-zinc-400"
              >
                None
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onChange({ isWarmup: !set.isWarmup })}
              className={`h-11 flex-1 rounded-lg text-sm font-semibold ${set.isWarmup ? "bg-amber-500 text-zinc-950" : "bg-zinc-800"}`}
            >
              {set.isWarmup ? "Warm-up ✓" : "Mark warm-up"}
            </button>
            <button type="button" onClick={onRemove} className="h-11 flex-1 rounded-lg bg-zinc-800 text-sm font-semibold text-red-400">
              Delete set
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
