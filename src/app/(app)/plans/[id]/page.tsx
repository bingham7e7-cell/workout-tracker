import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { PlanEditor } from "@/components/PlanEditor";
import { getPlan, listTemplates } from "@/lib/data/queries";

export default async function EditPlanPage({ params }: PageProps<"/plans/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [plan, templates] = await Promise.all([getPlan(id), listTemplates()]);
  if (!plan) notFound();
  return (
    <>
      <PageHeader title={plan.name} />
      <PlanEditor initial={plan} availableTemplates={templates} />
    </>
  );
}
