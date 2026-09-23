"use client";

import { useState, useSyncExternalStore } from "react";
import type { TimeZoneMode } from "@/lib/format";

const noopSubscribe = () => () => {};

function dayKey(date: Date, timeZone: string | undefined): string {
  // en-CA formats as YYYY-MM-DD, a convenient sortable/comparable calendar-day key.
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function dayLabel(date: Date, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat(undefined, { timeZone, weekday: "narrow" }).format(date);
}

/** Last 7 calendar days (today rightmost) in the user's time zone setting, marking which had a completed workout. */
export function WeekStrip({ finishedIsoDates, tz }: { finishedIsoDates: string[]; tz: TimeZoneMode }) {
  const onClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  // Read once on mount (not on every render, which would re-trigger this
  // component for no reason since the strip only needs to be right "now" as
  // of when the page opened).
  const [now] = useState(() => Date.now());
  if (!onClient) return <div className="mb-6 h-16" aria-hidden />;

  const timeZone = tz === "utc" ? "UTC" : undefined;
  // Exact 24h steps back from now, not local calendar-day arithmetic, so this
  // doesn't secretly depend on the browser's own time zone when tz === "utc".
  const days = Array.from({ length: 7 }, (_, i) => new Date(now - (6 - i) * 86_400_000));
  const doneDays = new Set(finishedIsoDates.map((iso) => dayKey(new Date(iso), timeZone)));

  return (
    <div className="mb-6 flex justify-between">
      {days.map((d, i) => {
        const done = doneDays.has(dayKey(d, timeZone));
        return (
          <div key={i} className="flex flex-col items-center gap-1.5">
            <div
              role="img"
              aria-label={done ? "Workout completed" : "No workout"}
              className={`flex h-9 w-9 items-center justify-center rounded-full border-2 ${
                done ? "border-red-500 bg-red-500" : "border-zinc-700"
              }`}
            >
              {done && (
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-xs text-zinc-500">{dayLabel(d, timeZone)}</span>
          </div>
        );
      })}
    </div>
  );
}
