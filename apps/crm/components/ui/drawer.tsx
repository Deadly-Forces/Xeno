"use client";
import { X } from "lucide-react";
import type { ReactNode } from "react";
export function Drawer({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }): JSX.Element | null { if (!open) return null; return <div className="fixed inset-0 z-50 bg-black/40" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><aside className="ml-auto h-full w-[min(88vw,360px)] bg-white shadow-xl"><header className="flex items-center justify-between border-b border-line px-4 py-3"><strong>{title}</strong><button className="btn size-8 p-0" onClick={onClose} aria-label="Close"><X size={15} /></button></header><div className="p-4">{children}</div></aside></div>; }
