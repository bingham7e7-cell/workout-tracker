import { PageHeader } from "@/components/PageHeader";
import { SettingsForm } from "@/components/SettingsForm";
import { getTimeZoneMode, getWeightUnit } from "@/lib/data/queries";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await getSupabaseServer();
  const [unit, timeZoneMode, { data }] = await Promise.all([getWeightUnit(), getTimeZoneMode(), supabase.auth.getClaims()]);
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsForm unit={unit} timeZoneMode={timeZoneMode} email={(data?.claims?.email as string | undefined) ?? ""} />
    </>
  );
}
