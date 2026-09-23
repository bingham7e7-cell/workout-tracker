import { PageHeader } from "@/components/PageHeader";
import { HOW_IT_WORKS_PARAGRAPHS } from "@/lib/domain/workloadExplain";

export default function HowMuscleMapWorksPage() {
  return (
    <>
      <PageHeader title="How the muscle map works" />
      <div className="space-y-4 text-zinc-300">
        {HOW_IT_WORKS_PARAGRAPHS.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </>
  );
}
