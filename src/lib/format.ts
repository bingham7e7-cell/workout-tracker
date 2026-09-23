/**
 * "Automatic" follows the device's own time zone (the historical behavior —
 * pass no `timeZone` to Intl at all); "UTC" always shows Zulu time regardless
 * of where the phone is. Set per-user in Settings, stored in `profiles.time_zone_mode`.
 */
export type TimeZoneMode = "auto" | "utc";

export function isTimeZoneMode(value: unknown): value is TimeZoneMode {
  return value === "auto" || value === "utc";
}

function intlTimeZone(tz: TimeZoneMode): string | undefined {
  return tz === "utc" ? "UTC" : undefined;
}

export function formatDate(iso: string, tz: TimeZoneMode = "auto"): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: intlTimeZone(tz),
  });
}

export function formatTime(iso: string, tz: TimeZoneMode = "auto"): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: intlTimeZone(tz) });
}

export function formatDuration(startIso: string, endIso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
