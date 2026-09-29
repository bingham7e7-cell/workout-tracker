/**
 * IANA time zone helpers for the "Fixed time zone" setting and the workout
 * time editor. Pure functions, no database — `Intl` already ships the full
 * time zone database on the phone/server, so no extra dependency is needed.
 */

export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number };

/** Every IANA time zone name the runtime knows about, sorted alphabetically. */
export function listTimeZones(): string[] {
  return [...Intl.supportedValuesOf("timeZone")].sort();
}

export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** The device's own IANA zone, e.g. "America/Chicago". */
export function deviceTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/** How far `zone` is from UTC at a given instant, in milliseconds (east of UTC is positive). */
function offsetMs(instant: Date, zone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return asIfUtc - instant.getTime();
}

/**
 * Converts wall-clock date/time components, as entered in `zone`, to the UTC
 * instant they represent. Iterates twice to stay correct across a DST
 * transition (the offset a moment falls in can itself depend on the moment).
 */
export function zonedTimeToUtcIso(parts: ZonedParts, zone: string): string {
  const asUtcGuess = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  let instant = asUtcGuess;
  for (let i = 0; i < 2; i++) {
    instant = asUtcGuess - offsetMs(new Date(instant), zone);
  }
  return new Date(instant).toISOString();
}

/** The reverse of `zonedTimeToUtcIso`: what a UTC instant reads as on a wall clock in `zone`. */
export function utcIsoToZonedParts(iso: string, zone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/** "UTC−5" / "UTC+5:30" / "UTC+0" — the zone's current offset, for labelling a picker. */
export function formatZoneOffset(zone: string, at: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(at);
  const raw = parts.find((p) => p.type === "timeZoneName")?.value ?? "GMT+0";
  return raw.replace("GMT", "UTC").replace("-", "−");
}

/** "America/Chicago, UTC−5" — a clear, unambiguous label for a chosen zone. */
export function formatZoneLabel(zone: string, at: Date = new Date()): string {
  return `${zone.replace(/_/g, " ")}, ${formatZoneOffset(zone, at)}`;
}
