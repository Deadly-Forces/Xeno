"use client";

import { BarChart3, ContactRound, LayoutDashboard, Megaphone, Search, UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

const actions = [
  { label: "Open overview", href: "/", icon: LayoutDashboard },
  { label: "Browse customers", href: "/customers", icon: ContactRound },
  { label: "Manage segments", href: "/segments", icon: UsersRound },
  { label: "Create campaign", href: "/campaigns/new", icon: Megaphone },
  { label: "View analytics", href: "/analytics", icon: BarChart3 }
];

export function CommandPalette(): JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => { const handler = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); setOpen((value) => !value); } if (event.key === "Escape") setOpen(false); }; window.addEventListener("keydown", handler); return () => window.removeEventListener("keydown", handler); }, []);
  const filtered = useMemo(() => actions.filter((action) => action.label.toLowerCase().includes(query.toLowerCase())), [query]);
  if (!open) return <button onClick={() => setOpen(true)} className="fixed bottom-5 right-5 z-20 hidden items-center gap-2 rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold text-[#53615c] shadow-sm transition hover:-translate-y-0.5 hover:shadow-md lg:flex"><Search size={14} /> Quick actions <kbd>Ctrl K</kbd></button>;
  return <div className="fixed inset-0 z-[70] bg-[#102a24]/40 p-4 pt-[12vh]" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}><div className="mx-auto max-w-lg overflow-hidden rounded-xl border border-line bg-white shadow-2xl"><div className="flex items-center gap-3 border-b border-line px-4"><Search size={18} className="text-[#71807a]" /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="h-14 min-w-0 flex-1 outline-none" placeholder="Navigate or start an action" /><button onClick={() => setOpen(false)} aria-label="Close command palette"><X size={17} /></button></div><div className="p-2">{filtered.length ? filtered.map(({ label, href, icon: Icon }) => <button key={href} onClick={() => { setOpen(false); setQuery(""); router.push(href); }} className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm transition hover:bg-[#eef7f3]"><Icon size={17} className="text-accent" />{label}</button>) : <p className="p-5 text-center text-sm text-[#71807a]">No matching action</p>}</div></div></div>;
}
