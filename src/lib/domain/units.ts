/**
 * Weight units. The database always stores kilograms; the app shows and
 * accepts the user's preferred unit and converts at the edges.
 */
export type WeightUnit = "lb" | "kg";

export const LB_PER_KG = 2.2046226218;

/** Convert a weight typed in `unit` to kilograms (3 decimals, as stored). */
export function toKg(value: number, unit: WeightUnit): number {
  const kg = unit === "kg" ? value : value / LB_PER_KG;
  return Math.round(kg * 1000) / 1000;
}

/** Convert stored kilograms to `unit`, rounded to 2 decimals. */
export function fromKg(kg: number, unit: WeightUnit): number {
  const value = unit === "kg" ? kg : kg * LB_PER_KG;
  return Math.round(value * 100) / 100;
}

/** "225", "102.5", "22.68" — no trailing zeros. */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return String(fromKg(kg, unit));
}

/** Plus/minus button step for the weight field. */
export function weightStep(unit: WeightUnit): number {
  return unit === "kg" ? 2.5 : 5;
}

export function isWeightUnit(value: unknown): value is WeightUnit {
  return value === "lb" || value === "kg";
}
