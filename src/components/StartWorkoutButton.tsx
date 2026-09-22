"use client";

import { useRouter } from "next/navigation";
import { createDraft, type TemplateExerciseSeed } from "@/lib/domain/draft";
import type { WeightUnit } from "@/lib/domain/units";
import { loadDraft, saveDraft } from "@/lib/client/draftStorage";

type Props = {
  unit: WeightUnit;
  template?: { id: string; name: string; exercises: TemplateExerciseSeed[] };
  className?: string;
  children: React.ReactNode;
};

/** Creates a new workout on this phone and opens the workout screen. */
export function StartWorkoutButton({ unit, template, className, children }: Props) {
  const router = useRouter();

  function start() {
    const existing = loadDraft();
    if (existing) {
      const discard = window.confirm(
        `You already have "${existing.name}" in progress.\n\nOK = discard it and start a new workout\nCancel = go back to it`,
      );
      if (!discard) {
        router.push("/workout");
        return;
      }
    }
    saveDraft(
      createDraft({
        name: template?.name ?? "Workout",
        templateId: template?.id ?? null,
        unit,
        exercises: template?.exercises ?? [],
      }),
    );
    router.push("/workout");
  }

  return (
    <button type="button" onClick={start} className={className}>
      {children}
    </button>
  );
}
