import { describe, expect, test } from "vitest";
import { formatWeight, fromKg, toKg } from "@/lib/domain/units";

describe("weight units", () => {
  test("kg is stored unchanged (rounded to 3 decimals)", () => {
    expect(toKg(100, "kg")).toBe(100);
    expect(toKg(102.5, "kg")).toBe(102.5);
    expect(toKg(1.23456, "kg")).toBe(1.235);
  });

  test("lb converts to kg", () => {
    expect(toKg(225, "lb")).toBe(102.058);
    expect(toKg(45, "lb")).toBe(20.412);
  });

  test("common lb weights round-trip exactly for display", () => {
    for (let lb = 0; lb <= 1000; lb += 2.5) {
      expect(fromKg(toKg(lb, "lb"), "lb")).toBe(lb);
    }
  });

  test("formatWeight drops trailing zeros", () => {
    expect(formatWeight(102.058, "lb")).toBe("225");
    expect(formatWeight(102.5, "kg")).toBe("102.5");
    expect(formatWeight(0, "lb")).toBe("0");
  });
});
