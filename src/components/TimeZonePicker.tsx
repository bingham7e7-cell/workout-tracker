"use client";

import { useMemo, useState } from "react";
import { formatZoneOffset, listTimeZones } from "@/lib/domain/timezone";

/** Full-screen searchable list of IANA time zones, used by Settings and the workout time editor. */
export function TimeZonePicker({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (zone: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const zones = useMemo(() => listTimeZones(), []);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return zones;
    return zones.filter((z) => z.toLowerCase().replace(/_/g, " ").includes(q));
  }, [zones, query]);

  return (
    <div role="dialog" aria-label="Choose time zone" className="fixed inset-0 z-30 flex flex-col bg-zinc-950">
      <div className="flex items-center gap-2 border-b border-zinc-900 px-4 pt-safe pb-3">
        <button
          onClick={onClose}
          aria-label="Close"
          className="-ml-2 flex h-11 w-10 shrink-0 items-center justify-center text-2xl text-zinc-400"
        >
          ‹
        </button>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search time zones"
          inputMode="search"
          className="h-11 flex-1 rounded-lg bg-zinc-900 px-3 text-base outline-none"
        />
      </div>
      <ul className="flex-1 overflow-y-auto pb-safe">
        {filtered.map((z) => (
          <li key={z}>
            <button
              onClick={() => {
                onChange(z);
                onClose();
              }}
              className={`flex h-12 w-full items-center justify-between px-4 text-left active:bg-zinc-900 ${
                z === value ? "text-emerald-400" : ""
              }`}
            >
              <span className="truncate">{z.replace(/_/g, " ")}</span>
              <span className="ml-2 shrink-0 text-sm text-zinc-500">{formatZoneOffset(z)}</span>
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="p-4 text-zinc-500">No matching time zone</li>}
      </ul>
    </div>
  );
}
