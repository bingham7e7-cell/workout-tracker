import { describe, expect, test } from "vitest";
import {
  formatZoneOffset,
  isValidTimeZone,
  listTimeZones,
  utcIsoToZonedParts,
  zonedTimeToUtcIso,
} from "@/lib/domain/timezone";

describe("zonedTimeToUtcIso", () => {
  test("a time entered in a chosen time zone is saved as the correct UTC time (winter, UTC-6)", () => {
    // 10:00am in Chicago in January (CST, UTC-6) is 16:00 UTC.
    const iso = zonedTimeToUtcIso({ year: 2026, month: 1, day: 15, hour: 10, minute: 0 }, "America/Chicago");
    expect(iso).toBe("2026-01-15T16:00:00.000Z");
  });

  test("a time entered in a chosen time zone is saved as the correct UTC time (summer DST, UTC-5)", () => {
    // 10:00am in Chicago in July (CDT, UTC-5) is 15:00 UTC.
    const iso = zonedTimeToUtcIso({ year: 2026, month: 7, day: 15, hour: 10, minute: 0 }, "America/Chicago");
    expect(iso).toBe("2026-07-15T15:00:00.000Z");
  });

  test("India's half-hour offset (UTC+5:30) converts correctly", () => {
    const iso = zonedTimeToUtcIso({ year: 2026, month: 6, day: 1, hour: 9, minute: 30 }, "Asia/Kolkata");
    expect(iso).toBe("2026-06-01T04:00:00.000Z");
  });

  test("UTC itself is a no-op", () => {
    const iso = zonedTimeToUtcIso({ year: 2026, month: 3, day: 3, hour: 12, minute: 0 }, "UTC");
    expect(iso).toBe("2026-03-03T12:00:00.000Z");
  });

  test("round-trips through utcIsoToZonedParts", () => {
    const iso = zonedTimeToUtcIso({ year: 2026, month: 11, day: 20, hour: 8, minute: 45 }, "America/Chicago");
    expect(utcIsoToZonedParts(iso, "America/Chicago")).toEqual({ year: 2026, month: 11, day: 20, hour: 8, minute: 45 });
  });
});

describe("zone list and validation", () => {
  test("listTimeZones includes well-known IANA zones, sorted", () => {
    const zones = listTimeZones();
    expect(zones).toContain("America/Chicago");
    expect(zones).toContain("Asia/Tokyo");
    expect(zones).toEqual([...zones].sort());
  });

  test("isValidTimeZone accepts real zones and rejects junk", () => {
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("Not/AZone")).toBe(false);
  });
});

describe("formatZoneOffset", () => {
  test("labels a negative offset with a minus sign", () => {
    expect(formatZoneOffset("America/Chicago", new Date("2026-01-15T16:00:00Z"))).toBe("UTC−6");
  });

  test("labels UTC itself as +0", () => {
    expect(formatZoneOffset("UTC", new Date("2026-01-15T16:00:00Z"))).toBe("UTC+0");
  });
});
