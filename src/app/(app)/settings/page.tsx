import { PageHeader } from "@/components/PageHeader";
import { SettingsForm } from "@/components/SettingsForm";
import { getTimeZoneSetting, getWeightUnit } from "@/lib/data/queries";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await getSupabaseServer();
  const [unit, timeZoneSetting, { data }] = await Promise.all([
    getWeightUnit(),
    getTimeZoneSetting(),
    supabase.auth.getClaims(),
  ]);
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsForm unit={unit} timeZoneSetting={timeZoneSetting} email={(data?.claims?.email as string | undefined) ?? ""} />
    </>
  );
}
