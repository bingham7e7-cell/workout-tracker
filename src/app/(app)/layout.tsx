import { BottomNav } from "@/components/BottomNav";
import { requireUserId } from "@/lib/supabase/server";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  await requireUserId();
  return (
    <>
      <div className="mx-auto max-w-md px-4 pb-28">{children}</div>
      <BottomNav />
    </>
  );
}
