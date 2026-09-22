"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Home", icon: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10" },
  { href: "/templates", label: "Templates", icon: "M5 4h14v16H5zM9 8h6M9 12h6M9 16h3" },
  { href: "/history", label: "History", icon: "M12 7v5l3 3M21 12a9 9 0 1 1-9-9 9 9 0 0 1 9 9z" },
  { href: "/settings", label: "Settings", icon: "M4 6h16M4 12h16M4 18h16" },
];

export function BottomNav() {
  const path = usePathname();
  // The active-workout screen has its own full-screen controls.
  if (path.startsWith("/workout")) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-zinc-950/95 pb-safe backdrop-blur">
      <ul className="mx-auto flex max-w-md">
        {ITEMS.map((item) => {
          const active = item.href === "/" ? path === "/" : path.startsWith(item.href);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                className={`flex h-16 flex-col items-center justify-center gap-1 text-xs ${active ? "text-emerald-400" : "text-zinc-400"}`}
              >
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={item.icon} />
                </svg>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
