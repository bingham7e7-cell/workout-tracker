import { PageHeader } from "@/components/PageHeader";
import { AiPlanImportScreen } from "@/components/AiPlanImportScreen";
import { listExercises, listMuscleGroups } from "@/lib/data/queries";

export default async function AiPlanImportPage() {
  const [exercises, muscleGroups] = await Promise.all([listExercises(), listMuscleGroups()]);
  const active = exercises.filter((e) => !e.archived).map((e) => ({ id: e.id, name: e.name }));
  return (
    <>
      <PageHeader title="Build a plan with AI" />
      <AiPlanImportScreen exercises={active} muscleGroups={muscleGroups} />
    </>
  );
}
