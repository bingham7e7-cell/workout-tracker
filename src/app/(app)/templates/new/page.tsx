import { PageHeader } from "@/components/PageHeader";
import { TemplateEditor } from "@/components/TemplateEditor";

export default function NewTemplatePage() {
  return (
    <>
      <PageHeader title="New template" />
      <TemplateEditor initial={null} />
    </>
  );
}
