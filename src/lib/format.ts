import { isValidTimeZone } from "./domain/timezone";

/**
 * "Automatic" follows the device's own time zone (the historical behavior —
 * pass no `timeZone` to Intl at all); "UTC" always shows Zulu time regardless
 * of where the phone is; "fixed" always shows a specific IANA zone the user
 * picked (`zone`), e.g. "America/Chicago". Set per-user in Settings, stored
 * in `profiles.time_zone_mode` (+ `time_zone_name` for "fixed").
 */
export type TimeZoneMode = "auto" | "utc" | "fixed";

export type TimeZoneSetting = { mode: "auto" } | { mode: "utc" } | { mode: "fixed"; zone: string };

/** Builds a validated `TimeZoneSetting` from the raw `profiles` columns, falling back to Automatic. */
export function toTimeZoneSetting(mode: unknown, zone: unknown): TimeZoneSetting {
  if (mode === "utc") return { mode: "utc" };
  if (mode === "fixed" && typeof zone === "string" && isValidTimeZone(zone)) return { mode: "fixed", zone };
  return { mode: "auto" };
}

/** Resolves a `TimeZoneSetting` to the IANA zone name to pass to `Intl`, or `undefined` for Automatic (the device's own zone). */
export function intlTimeZone(tz: TimeZoneSetting): string | undefined {
  return tz.mode === "utc" ? "UTC" : tz.mode === "fixed" ? tz.zone : undefined;
}

export function formatDate(iso: string, tz: TimeZoneSetting = { mode: "auto" }): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: intlTimeZone(tz),
  });
}

export function formatTime(iso: string, tz: TimeZoneSetting = { mode: "auto" }): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit", timeZone: intlTimeZone(tz) });
}

export function formatDuration(startIso: string, endIso: string): string {
  const minutes = Math.max(0, Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000));
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
