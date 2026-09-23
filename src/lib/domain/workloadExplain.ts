/**
 * Plain-language descriptions of the muscle workload formula (lib/domain/workload.ts),
 * built from that module's own exported constants so the words on screen and the real
 * calculation can never say different things.
 */
import {
  DEFAULT_EFFORT,
  MAX_RPE_EFFORT,
  MIN_RPE_EFFORT,
  RECENCY_HALF_LIFE_HOURS,
  WORKLOAD_WINDOW_DAYS,
  roleWeight,
  type MuscleRole,
} from "./workload";

const RECENCY_HALF_LIFE_DAYS = RECENCY_HALF_LIFE_HOURS / 24;

export const PRIMARY_CREDIT_PERCENT = roleWeight("primary") * 100;
export const SECONDARY_CREDIT_PERCENT = roleWeight("secondary") * 100;
export const DEFAULT_EFFORT_PERCENT = DEFAULT_EFFORT * 100;
export const MIN_RPE_EFFORT_PERCENT = MIN_RPE_EFFORT * 100;
export const MAX_RPE_EFFORT_PERCENT = MAX_RPE_EFFORT * 100;

export function creditPercentLabel(role: MuscleRole): string {
  return `${Math.round(roleWeight(role) * 100)}%`;
}

/**
 * "Primary (100% credit per set): chest, front delts." / "Secondary (50%
 * credit per set): triceps." — one line per role that has at least one
 * muscle, using the exercise's real primary/secondary muscle names.
 */
export function describeMuscleCredit(primaryNames: string[], secondaryNames: string[]): string[] {
  const lines: string[] = [];
  if (primaryNames.length > 0) {
    lines.push(`Primary (${creditPercentLabel("primary")} credit per set): ${primaryNames.join(", ")}.`);
  }
  if (secondaryNames.length > 0) {
    lines.push(`Secondary (${creditPercentLabel("secondary")} credit per set): ${secondaryNames.join(", ")}.`);
  }
  return lines;
}

/** Paragraphs for the "How the muscle map works" screen — the full formula in plain language. */
export const HOW_IT_WORKS_PARAGRAPHS: string[] = [
  "Each muscle's color is an estimate of how much it's been trained recently — not a medical measure of recovery or readiness.",
  `Only completed working sets count — warm-up sets never contribute, no matter how heavy.`,
  `Each set's effort comes from its RPE (how hard it felt, on a 1–10 scale): effort = RPE ÷ 10, so an RPE of 10 is ${MAX_RPE_EFFORT_PERCENT}% effort — but it's never counted below ${MIN_RPE_EFFORT_PERCENT}%, even for a very low RPE. A set logged with no RPE at all defaults to ${DEFAULT_EFFORT_PERCENT}% effort.`,
  `Each exercise trains some muscles more directly than others. A muscle listed as primary gets ${PRIMARY_CREDIT_PERCENT}% credit for the set; a secondary muscle gets ${SECONDARY_CREDIT_PERCENT}%.`,
  `Recent training counts more than older training: a set's contribution starts at 100% right when the workout finishes and halves every ${RECENCY_HALF_LIFE_HOURS} hours (${RECENCY_HALF_LIFE_DAYS} days), fading out smoothly rather than dropping off a cliff after some fixed number of days.`,
  `A muscle's score is the sum of every recent working set's contribution: effort × primary-or-secondary credit × how recently it happened. Sets older than ${WORKLOAD_WINDOW_DAYS} days aren't counted at all — by then a set's contribution has faded to well under 1% of its starting value anyway.`,
];
