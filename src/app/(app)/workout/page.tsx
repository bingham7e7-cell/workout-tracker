import { WorkoutScreen } from "@/components/workout/WorkoutScreen";
import { getTimeZoneMode } from "@/lib/data/queries";

export default async function WorkoutPage() {
  const tz = await getTimeZoneMode();
  return <WorkoutScreen tz={tz} />;
}
