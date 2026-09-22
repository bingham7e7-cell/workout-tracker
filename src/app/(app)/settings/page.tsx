import { PageHeader } from "@/components/PageHeader";
import { SettingsForm } from "@/components/SettingsForm";
import { getWeightUnit } from "@/lib/data/queries";
import { getSupabaseServer } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await getSupabaseServer();
  const [unit, { data }] = await Promise.all([getWeightUnit(), supabase.auth.getClaims()]);
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsForm unit={unit} email={(data?.claims?.email as string | undefined) ?? ""} />
    </>
  );
}
