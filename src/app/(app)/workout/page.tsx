import { WorkoutScreen } from "@/components/workout/WorkoutScreen";

// Deliberately NOT a server fetch of the time zone setting: this screen must
// keep working with no network at all (CLAUDE.md — the active workout lives
// on the device), so it isn't allowed to depend on a database round-trip to
// render. It only affects the "Started 9:14" label, so it always shows
// device-local time here, regardless of the Settings > Time zone choice.
export default function WorkoutPage() {
  return <WorkoutScreen />;
}
