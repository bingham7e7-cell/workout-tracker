"use client";

import { useSyncExternalStore } from "react";
import { formatDate, formatTime } from "@/lib/format";

const noopSubscribe = () => () => {};

/**
 * Shows a date/time in the PHONE's timezone. Pages are rendered on the server
 * (UTC on Vercel), so formatting there would put evening workouts on the
 * wrong day. This renders nothing on the server and fills in on the phone.
 */
export function LocalTime({ iso, show = "date" }: { iso: string; show?: "date" | "time" | "dateTime" }) {
  const onClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  if (!onClient) return <span className="invisible">…</span>;
  const text =
    show === "date" ? formatDate(iso) : show === "time" ? formatTime(iso) : `${formatDate(iso)} · ${formatTime(iso)}`;
  return <time dateTime={iso}>{text}</time>;
}
