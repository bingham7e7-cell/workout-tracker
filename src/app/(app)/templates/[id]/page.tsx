import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { TemplateEditor } from "@/components/TemplateEditor";
import { getTemplate } from "@/lib/data/queries";

export default async function EditTemplatePage({ params }: PageProps<"/templates/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const template = await getTemplate(id);
  if (!template) notFound();
  return (
    <>
      <PageHeader title="Edit template" />
      <TemplateEditor initial={template} />
    </>
  );
}
