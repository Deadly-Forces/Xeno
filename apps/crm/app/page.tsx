"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, ContactRound, MousePointerClick, Megaphone, ShoppingBag } from "lucide-react";
import Link from "next/link";
import { Card } from "../components/ui/card";

type Dashboard = { customers: number; active: number; conversions: number; openRate: number; campaigns: Array<{ id: string; name: string; channel: string; status: string; createdAt: string; segment: { name: string } }> };

export default function DashboardPage(): JSX.Element {
  const { data, isLoading } = useQuery<Dashboard>({ queryKey: ["dashboard"], queryFn: async () => { const response = await fetch("/api/dashboard"); if (!response.ok) throw new Error("Unable to load dashboard"); return response.json() as Promise<Dashboard>; } });
  const metrics = [
    { label: "Customers", value: data?.customers.toLocaleString() ?? "-", icon: ContactRound, note: "Known shopper profiles" },
    { label: "Active campaigns", value: data?.active.toString() ?? "-", icon: Megaphone, note: "Currently dispatching" },
    { label: "Average open rate", value: data ? `${data.openRate}%` : "-", icon: MousePointerClick, note: "Across all messages" },
    { label: "Conversions", value: data?.conversions.toLocaleString() ?? "-", icon: ShoppingBag, note: "Attributed orders" }
  ];
  return <div className="space-y-7"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="label mb-2">Campaign command center</p><h1 className="text-3xl font-semibold">Campaign operations</h1><p className="mt-1 text-sm text-[#64716c]">A live view of customer reach and response.</p></div><div className="flex gap-2"><Link className="btn" href="/segments">Build segment</Link><Link className="btn btn-primary" href="/campaigns/new">New campaign <ArrowUpRight size={16} /></Link></div></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(({ label, value, icon: Icon, note }) => <Card className="p-5" key={label}><div className="mb-6 flex items-center justify-between"><span className="text-sm font-medium text-[#65736e]">{label}</span><Icon size={18} className="text-accent" /></div><strong className="text-3xl font-semibold">{isLoading ? "..." : value}</strong><p className="mt-1 text-xs text-[#7b8783]">{note}</p></Card>)}</section>
    <section className="panel"><div className="flex items-center justify-between border-b border-line px-5 py-4"><div><h2 className="font-semibold">Recent campaigns</h2><p className="text-xs text-[#7b8783]">Latest activity across every channel</p></div><Link href="/analytics" className="text-sm font-semibold text-accent">View analytics</Link></div><div className="divide-y divide-line">{data?.campaigns.map((campaign) => <Link href={`/campaigns/${campaign.id}`} key={campaign.id} className="grid gap-2 px-5 py-4 hover:bg-[#f8faf9] sm:grid-cols-[1fr_150px_120px_120px] sm:items-center"><div><strong className="text-sm">{campaign.name}</strong><p className="text-xs text-[#7b8783]">{campaign.segment.name}</p></div><span className="text-sm">{campaign.channel}</span><span className="text-sm">{new Date(campaign.createdAt).toLocaleDateString()}</span><span className="w-fit rounded-full bg-[#e7f3ee] px-2.5 py-1 text-xs font-bold text-accent">{campaign.status}</span></Link>)}</div></section></div>;
}
