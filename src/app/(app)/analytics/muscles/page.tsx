import { PageHeader } from "@/components/PageHeader";
import { MuscleWorkloadView } from "@/components/analytics/MuscleWorkloadView";
import { getRecentSetsForWorkload, listMuscleGroups } from "@/lib/data/queries";
import { muscleWorkload } from "@/lib/domain/workload";

export default async function MuscleWorkloadPage() {
  const [sets, muscleGroups] = await Promise.all([getRecentSetsForWorkload(), listMuscleGroups()]);
  const workload = muscleWorkload(sets);
  const muscleNames = Object.fromEntries(muscleGroups.map((m) => [m.id, m.name]));

  return (
    <>
      <PageHeader title="Muscle workload" />
      <MuscleWorkloadView workload={workload} muscleNames={muscleNames} />
    </>
  );
}
