import { notFound } from "next/navigation";
import { EditWorkoutScreen } from "@/components/workout/EditWorkoutScreen";
import { getTimeZoneSetting, getWeightUnit, getWorkout } from "@/lib/data/queries";

export default async function EditWorkoutPage({ params }: PageProps<"/history/[id]/edit">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [workout, unit, timeZoneSetting] = await Promise.all([getWorkout(id), getWeightUnit(), getTimeZoneSetting()]);
  if (!workout) notFound();
  return <EditWorkoutScreen workout={workout} unit={unit} timeZoneSetting={timeZoneSetting} />;
}
