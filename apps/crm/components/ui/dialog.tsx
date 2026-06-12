"use client";

import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Dialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }): JSX.Element | null {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-label={title} className="panel max-h-[90vh] w-full max-w-2xl overflow-y-auto shadow-xl">
      <header className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="font-semibold">{title}</h2><button className="btn size-8 p-0" onClick={onClose} aria-label="Close"><X size={15} /></button></header>
      <div className="p-5">{children}</div>
    </section>
  </div>;
}
