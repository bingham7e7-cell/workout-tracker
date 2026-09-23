import { PageHeader } from "@/components/PageHeader";
import { AiPlanImportScreen } from "@/components/AiPlanImportScreen";
import { listExercises, listMuscleGroups } from "@/lib/data/queries";

export default async function AiPlanImportPage() {
  const [exercises, muscleGroups] = await Promise.all([listExercises(), listMuscleGroups()]);
  // Matching (and the duplicate-name check) uses every exercise, archived
  // included — the exercises table's unique name index covers archived rows
  // too, so a "new" exercise reusing an archived name would otherwise fail
  // at save time with no warning. The AI prompt only suggests active ones.
  const all = exercises.map((e) => ({ id: e.id, name: e.name }));
  const activeNames = exercises.filter((e) => !e.archived).map((e) => e.name);
  return (
    <>
      <PageHeader title="Build a plan with AI" />
      <AiPlanImportScreen exercises={all} promptExerciseNames={activeNames} muscleGroups={muscleGroups} />
    </>
  );
}
