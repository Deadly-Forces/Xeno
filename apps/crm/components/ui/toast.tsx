"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type Toast = { id: number; title: string; message?: string; tone: "success" | "error" };
type ToastContextValue = { notify: (toast: Omit<Toast, "id">) => void };
const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }): JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const notify = useCallback((toast: Omit<Toast, "id">) => {
    const id = Date.now();
    setToasts((items) => [...items, { ...toast, id }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4500);
  }, []);
  const value = useMemo(() => ({ notify }), [notify]);
  return <ToastContext.Provider value={value}>{children}<div className="fixed right-4 top-4 z-[80] grid w-[min(92vw,380px)] gap-2" aria-live="polite">{toasts.map((toast) => <div key={toast.id} className={`flex gap-3 rounded-lg border bg-white p-4 shadow-lg ${toast.tone === "success" ? "border-[#b9d9ca]" : "border-[#efc1b8]"}`}>{toast.tone === "success" ? <CheckCircle2 className="mt-0.5 text-accent" size={18} /> : <CircleAlert className="mt-0.5 text-[#c8503b]" size={18} />}<div className="min-w-0 flex-1"><strong className="text-sm">{toast.title}</strong>{toast.message && <p className="mt-1 text-xs text-[#64716c]">{toast.message}</p>}</div><button aria-label="Dismiss notification" onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}><X size={15} /></button></div>)}</div></ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within ToastProvider");
  return context;
}
