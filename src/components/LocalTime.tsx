"use client";

import { useSyncExternalStore } from "react";
import { formatDate, formatTime, type TimeZoneMode } from "@/lib/format";

const noopSubscribe = () => () => {};

/**
 * Shows a date/time in the user's chosen time zone setting (Automatic follows
 * the phone; UTC always shows Zulu time). Pages are rendered on the server
 * (UTC on Vercel), so formatting there would put evening workouts on the
 * wrong day in Automatic mode. This renders nothing on the server and fills
 * in on the phone.
 */
export function LocalTime({
  iso,
  show = "date",
  tz = "auto",
}: {
  iso: string;
  show?: "date" | "time" | "dateTime";
  tz?: TimeZoneMode;
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
