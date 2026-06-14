"use client";

import { FileJson, Upload } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";

const example = `[
  {
    "externalId": "CUST-9001",
    "name": "Jordan Lee",
    "email": "jordan@example.com",
    "phone": "+15551234567",
    "tags": ["new"],
    "city": "Austin",
    "ageGroup": "26-40",
    "gender": "non-binary",
    "channelPreference": "EMAIL",
    "orders": []
  }
]`;

export function ImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }): JSX.Element | null {
  const [mode, setMode] = useState<"json" | "csv">("json");
  const [json, setJson] = useState(example);
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(): Promise<void> {
    setSubmitting(true);
    setStatus("");
    try {
      const body = mode === "json" ? json : await file?.text();
      if (!body) throw new Error("Choose a CSV file first");
      const response = await fetch("/api/customers/bulk-import", { method: "POST", headers: { "content-type": mode === "json" ? "application/json" : "text/csv" }, body });
      const result = await response.json() as { imported?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Import failed");
      setStatus(`${result.imported ?? 0} customers imported`);
      onImported();
    } catch (error) { setStatus(error instanceof Error ? error.message : "Import failed"); }
    finally { setSubmitting(false); }
  }

  return <Dialog open={open} title="Import customers" onClose={onClose}>
    <div className="mb-5 flex gap-2"><button className={`btn ${mode === "json" ? "border-accent bg-[#eef7f3] text-accent" : ""}`} onClick={() => setMode("json")}><FileJson size={15} /> JSON</button><button className={`btn ${mode === "csv" ? "border-accent bg-[#eef7f3] text-accent" : ""}`} onClick={() => setMode("csv")}><Upload size={15} /> CSV file</button></div>
    {mode === "json" ? <textarea aria-label="Customer JSON" className="input min-h-80 font-mono text-xs" value={json} onChange={(event) => setJson(event.target.value)} /> : <label className="grid min-h-48 place-items-center rounded-md border border-dashed border-[#aebdb7] bg-[#f7f9f8] p-6 text-center"><input className="sr-only" type="file" accept=".csv,text/csv" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /><Upload className="mb-2 text-accent" /><strong className="text-sm">{file?.name ?? "Choose a CSV file"}</strong><span className="mt-1 text-xs text-[#71807a]">Maximum payload: 10 MB</span></label>}
    {status && <p className={`mt-3 text-sm ${status.includes("imported") ? "text-accent" : "text-red-700"}`}>{status}</p>}
    <div className="mt-5 flex justify-end gap-2"><button className="btn" onClick={onClose}>Close</button><button className="btn btn-primary" disabled={submitting} onClick={() => void submit()}>{submitting ? "Importing..." : "Import customers"}</button></div>
  </Dialog>;
}
