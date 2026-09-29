"use client";

import { useSyncExternalStore } from "react";
import { formatDate, formatTime, type TimeZoneSetting } from "@/lib/format";

const noopSubscribe = () => () => {};

/**
 * Shows a date/time in the user's chosen time zone setting (Automatic follows
 * the phone; UTC always shows Zulu time; Fixed always shows a chosen zone).
 * Pages are rendered on the server (UTC on Vercel), so formatting there would
 * put evening workouts on the wrong day in Automatic mode. This renders
 * nothing on the server and fills in on the phone.
 */
export function LocalTime({
  iso,
  show = "date",
  tz = { mode: "auto" },
}: {
  iso: string;
  show?: "date" | "time" | "dateTime";
  tz?: TimeZoneSetting;
}) {
  const onClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!onClient) return <span className="invisible">…</span>;
  const text =
    show === "date"
      ? formatDate(iso, tz)
      : show === "time"
        ? formatTime(iso, tz)
        : `${formatDate(iso, tz)} · ${formatTime(iso, tz)}`;
  return <time dateTime={iso}>{text}</time>;
}
