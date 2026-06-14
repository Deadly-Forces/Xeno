"use client";
import { BarChart3, ContactRound, LayoutDashboard, Megaphone, Menu, Settings2, Sparkles, UsersRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { usePathname } from "next/navigation";
import { Drawer } from "@/components/ui/drawer";

const links = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: ContactRound },
  { href: "/segments", label: "Segments", icon: UsersRound },
  { href: "/campaigns/new", label: "Campaigns", icon: Megaphone },
  { href: "/analytics", label: "Analytics", icon: BarChart3 }
];

export function Navigation(): JSX.Element {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data: session } = useSession();
  const visibleLinks = session?.user.role === "ADMIN" ? [...links, { href: "/operations", label: "Operations", icon: Settings2 }] : links;
  const isActive = (href: string): boolean => href === "/" ? pathname === "/" : pathname.startsWith(href === "/campaigns/new" ? "/campaigns" : href);
  const mobileLinks = <nav className="space-y-1">{visibleLinks.map(({ href, label, icon: Icon }) => <Link aria-current={isActive(href) ? "page" : undefined} onClick={() => setOpen(false)} key={href} href={href} className={`flex items-center gap-3 rounded-md px-3 py-3 text-sm transition ${isActive(href) ? "bg-[#e7f3ee] font-semibold text-accent" : "hover:bg-[#eef7f3]"}`}><Icon size={17} />{label}</Link>)}</nav>;
  return <><header className="sticky top-0 z-40 flex items-center justify-between bg-[#102a24] px-4 py-3 text-white md:hidden"><strong>Northstar CRM</strong><button className="grid size-9 place-items-center rounded-md hover:bg-white/10" onClick={() => setOpen(true)} aria-label="Open navigation"><Menu size={19} /></button></header><Drawer open={open} title="Northstar CRM" onClose={() => setOpen(false)}>{mobileLinks}</Drawer><aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-line bg-[#102a24] px-4 py-5 text-white md:block">
    <div className="mb-8 flex items-center gap-3 px-2"><div className="grid size-9 place-items-center rounded-md bg-[#ef8e6e]"><Sparkles size={18} /></div><div><strong className="block">Northstar CRM</strong><span className="text-xs text-[#a9c5bb]">Retail intelligence</span></div></div>
    <nav className="space-y-1">{visibleLinks.map(({ href, label, icon: Icon }) => <Link aria-current={isActive(href) ? "page" : undefined} key={href} href={href} className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${isActive(href) ? "bg-white/14 font-semibold text-white shadow-[inset_3px_0_0_#ef8e6e]" : "text-[#d7e5df] hover:bg-white/10 hover:text-white"}`}><Icon size={17} />{label}</Link>)}</nav>
    <div className="absolute bottom-5 left-4 right-4 border-t border-white/10 pt-4 text-xs text-[#a9c5bb]">{session?.user.role ?? "Authenticated"} workspace<br /><span className="text-white">{session?.user.name ?? session?.user.email ?? "CRM user"}</span></div>
  </aside></>;
}
