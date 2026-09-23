import { notFound } from "next/navigation";
import { EditWorkoutScreen } from "@/components/workout/EditWorkoutScreen";
import { getWeightUnit, getWorkout } from "@/lib/data/queries";

export default async function EditWorkoutPage({ params }: PageProps<"/history/[id]/edit">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [workout, unit] = await Promise.all([getWorkout(id), getWeightUnit()]);
  if (!workout) notFound();
  return <EditWorkoutScreen workout={workout} unit={unit} />;
}
