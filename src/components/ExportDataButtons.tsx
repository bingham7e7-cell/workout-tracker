"use client";

import { useState } from "react";
import { exportAsCsv, exportAsJson } from "@/lib/client/exportData";
import { describeError } from "@/lib/client/errors";

export function ExportDataButtons() {
  const [busy, setBusy] = useState<"json" | "csv" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(kind: "json" | "csv") {
    if (busy) return;
    setBusy(kind);
    setError(null);
    try {
      await (kind === "json" ? exportAsJson() : exportAsCsv());
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section>
      <h2 className="mb-1 font-semibold">Export your data</h2>
      <p className="mb-3 text-sm text-zinc-400">
        Download every workout, template and exercise you&apos;ve logged. JSON is a complete backup; CSV is one row
        per set, for spreadsheets. Weights are always in kilograms.
      </p>
      <div className="flex gap-2">
        <button
          onClick={() => run("json")}
          disabled={busy !== null}
          className="h-12 flex-1 rounded-xl bg-zinc-800 font-medium disabled:opacity-50"
        >
          {busy === "json" ? "Preparing…" : "Export JSON"}
        </button>
        <button
          onClick={() => run("csv")}
          disabled={busy !== null}
          className="h-12 flex-1 rounded-xl bg-zinc-800 font-medium disabled:opacity-50"
        >
          {busy === "csv" ? "Preparing…" : "Export CSV"}
        </button>
      </div>
      {error && <p className="mt-3 rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
    </section>
  );
}
