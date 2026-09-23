import { PageHeader } from "@/components/PageHeader";
import { PlanEditor } from "@/components/PlanEditor";
import { listTemplates } from "@/lib/data/queries";

export default async function NewPlanPage() {
  const templates = await listTemplates();
  return (
    <>
      <PageHeader title="Build a plan" />
      <PlanEditor initial={null} availableTemplates={templates} />
    </>
  );
}
