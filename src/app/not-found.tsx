import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto mt-24 max-w-md space-y-4 px-4 text-center">
      <h1 className="text-xl font-semibold">Not found</h1>
      <p className="text-zinc-400">This page doesn&apos;t exist, or it was deleted.</p>
      <Link href="/" className="inline-flex h-12 items-center rounded-xl bg-zinc-800 px-6">
        Home
      </Link>
    </main>
  );
}
