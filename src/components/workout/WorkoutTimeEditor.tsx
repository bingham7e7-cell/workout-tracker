"use client";

import { useState, useSyncExternalStore } from "react";
import { TimeZonePicker } from "@/components/TimeZonePicker";
import { deviceTimeZone, formatZoneLabel, utcIsoToZonedParts, zonedTimeToUtcIso } from "@/lib/domain/timezone";
import { formatDuration } from "@/lib/format";
import type { TimeZoneSetting } from "@/lib/format";

const noopSubscribe = () => () => {};

function resolveZone(setting: TimeZoneSetting): string {
  if (setting.mode === "fixed") return setting.zone;
  if (setting.mode === "utc") return "UTC";
  return deviceTimeZone();
}

function toInputValue(iso: string, zone: string): string {
  const p = utcIsoToZonedParts(iso, zone);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

function fromInputValue(value: string, zone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m;
  return zonedTimeToUtcIso({ year: Number(y), month: Number(mo), day: Number(d), hour: Number(h), minute: Number(mi) }, zone);
}

/**
 * Lets the owner change a completed workout's start/end date and time, and
 * pick which time zone those clock values are entered in (defaulting to their
 * app-wide setting, but overridable per edit — e.g. logging a trip workout in
 * the zone it actually happened in). Always reports times back as UTC ISO
 * strings; changing the zone re-labels the same instants, it never shifts them.
 *
 * Renders nothing until mounted on the phone: "Automatic" resolves to the
 * device's own zone, which the server (UTC on Vercel) can't know, so
 * rendering it there would mismatch on hydration — same reasoning as
 * `LocalTime`/`WeekStrip`.
 */
export function WorkoutTimeEditor({
  startedAtIso,
  finishedAtIso,
  defaultTimeZone,
  onChange,
}: {
  startedAtIso: string;
  finishedAtIso: string;
  defaultTimeZone: TimeZoneSetting;
  onChange: (times: { startedAtIso: string; finishedAtIso: string }) => void;
}) {
  const [zone, setZone] = useState(() => resolveZone(defaultTimeZone));
  const [pickerOpen, setPickerOpen] = useState(false);
  const onClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!onClient) return <section className="mb-6 h-56 rounded-xl bg-zinc-900" aria-hidden />;

  return (
    <section className="mb-6 rounded-xl bg-zinc-900 p-4">
      <h2 className="mb-3 font-semibold">Date &amp; time</h2>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm text-zinc-400">Start</span>
        <input
          type="datetime-local"
          value={toInputValue(startedAtIso, zone)}
          onChange={(e) => {
            const iso = fromInputValue(e.target.value, zone);
            if (iso) onChange({ startedAtIso: iso, finishedAtIso });
          }}
          className="h-12 w-full rounded-lg bg-zinc-800 px-3 text-base"
        />
      </label>

      <label className="mb-3 block">
        <span className="mb-1 block text-sm text-zinc-400">End</span>
        <input
          type="datetime-local"
          value={toInputValue(finishedAtIso, zone)}
          onChange={(e) => {
            const iso = fromInputValue(e.target.value, zone);
            if (iso) onChange({ startedAtIso, finishedAtIso: iso });
          }}
          className="h-12 w-full rounded-lg bg-zinc-800 px-3 text-base"
        />
      </label>

      <p className="mb-3 text-sm text-zinc-400">Duration: {formatDuration(startedAtIso, finishedAtIso)}</p>

      <button
        onClick={() => setPickerOpen(true)}
        className="flex h-12 w-full items-center justify-between rounded-lg bg-zinc-800 px-3 text-left text-sm"
      >
        <span>
          Entering times in <span className="font-medium text-zinc-200">{formatZoneLabel(zone)}</span>
        </span>
        <span className="text-emerald-400">Change</span>
      </button>

      {pickerOpen && (
        <TimeZonePicker
          value={zone}
          onChange={(next) => setZone(next)}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </section>
  );
}
