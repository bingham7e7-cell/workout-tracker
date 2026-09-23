"use client";

import { useRouter } from "next/navigation";
import { countSets, createDraft, type TemplateExerciseSeed } from "@/lib/domain/draft";
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
      const status = existing.finishedAt ? "finished, but not saved yet" : "in progress";
      // The safe choice (resume) is the default; discarding needs a second, explicit "OK".
      if (window.confirm(`You already have "${existing.name}" (${status}). Resume it?`)) {
        router.push("/workout");
        return;
      }
      const { logged } = countSets(existing);
      const discard = window.confirm(
        `Discard "${existing.name}"${logged > 0 ? ` and its ${logged} logged set${logged === 1 ? "" : "s"}` : ""} and start a new workout?\n\nThis can't be undone.`,
      );
      if (!discard) return;
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
