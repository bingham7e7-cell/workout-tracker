export function PageHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <header className="pt-safe">
      <div className="flex items-center justify-between gap-3 py-5">
        <h1 className="truncate text-2xl font-bold">{title}</h1>
        {action}
      </div>
    </header>
  );
}
