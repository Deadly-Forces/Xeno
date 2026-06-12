"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Search, Upload } from "lucide-react";
import { useState } from "react";
import { ImportDialog } from "../../components/customers/import-dialog";

type Customer = { id: string; externalId: string; name: string; email: string | null; city: string; tags: string[]; totalOrderValue: string; totalOrders: number; channelPreference: string };
type Segment = { id: string; name: string };
type CustomerPage = { customers: Customer[]; nextCursor: string | null };

export default function CustomersPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [segment, setSegment] = useState("");
  const [sort, setSort] = useState("name");
  const [direction, setDirection] = useState("asc");
  const [cursor, setCursor] = useState<string | null>(null);
  const [history, setHistory] = useState<Array<string | null>>([]);
  const [importOpen, setImportOpen] = useState(false);
  const { data: segments = [] } = useQuery<Segment[]>({ queryKey: ["segments", "customer-filter"], queryFn: async () => (await fetch("/api/segments")).json() as Promise<Segment[]> });
  const { data, isLoading } = useQuery<CustomerPage>({ queryKey: ["customers", query, segment, sort, direction, cursor], queryFn: async () => { const params = new URLSearchParams({ q: query, limit: "25", sort, direction }); if (segment) params.set("segment", segment); if (cursor) params.set("cursor", cursor); const response = await fetch(`/api/customers?${params}`); if (!response.ok) throw new Error("Unable to load customers"); return response.json() as Promise<CustomerPage>; } });
  function resetCursor(): void { setCursor(null); setHistory([]); }
  return <div className="space-y-6"><header className="flex items-end justify-between"><div><p className="label mb-2">Audience</p><h1 className="text-3xl font-semibold">Customers</h1><p className="mt-1 text-sm text-[#64716c]">Search, inspect, and import shopper profiles.</p></div><button className="btn" onClick={() => setImportOpen(true)}><Upload size={16} /> Import</button></header>
    <section className="panel overflow-hidden"><div className="grid grid-cols-[minmax(240px,1fr)_220px_180px_120px] gap-3 border-b border-line p-4"><div className="relative"><Search className="absolute left-3 top-2.5 text-[#7b8783]" size={16} /><input value={query} onChange={(event) => { setQuery(event.target.value); resetCursor(); }} className="input pl-9" placeholder="Search name or email" /></div><select className="input" value={segment} onChange={(event) => { setSegment(event.target.value); resetCursor(); }}><option value="">All segments</option>{segments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><select className="input" value={sort} onChange={(event) => { setSort(event.target.value); resetCursor(); }}><option value="name">Name</option><option value="totalOrderValue">Lifetime value</option><option value="totalOrders">Order count</option><option value="lastOrderAt">Last order</option></select><select className="input" value={direction} onChange={(event) => { setDirection(event.target.value); resetCursor(); }}><option value="asc">Ascending</option><option value="desc">Descending</option></select></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-[#f2f5f3] text-xs uppercase text-[#66736e]"><tr><th className="px-5 py-3">Customer</th><th>City</th><th>Tags</th><th>Orders</th><th>Lifetime value</th><th>Channel</th></tr></thead><tbody className="divide-y divide-line">{isLoading ? <tr><td className="p-5" colSpan={6}>Loading customers...</td></tr> : data?.customers.map((customer) => <tr key={customer.id} className="hover:bg-[#fafbfa]"><td className="px-5 py-3"><strong>{customer.name}</strong><div className="text-xs text-[#7b8783]">{customer.email ?? customer.externalId}</div></td><td>{customer.city}</td><td><div className="flex gap-1">{customer.tags.slice(0, 2).map((tag) => <span className="rounded bg-[#edf2ef] px-2 py-1 text-xs" key={tag}>{tag}</span>)}</div></td><td>{customer.totalOrders}</td><td>${Number(customer.totalOrderValue).toFixed(2)}</td><td>{customer.channelPreference}</td></tr>)}</tbody></table></div>
      <footer className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-[#71807a]"><span>{data?.customers.length ?? 0} customers on this page</span><div className="flex gap-2"><button className="btn size-9 p-0" aria-label="Previous page" disabled={history.length === 0} onClick={() => { const previous = history.at(-1) ?? null; setHistory((items) => items.slice(0, -1)); setCursor(previous); }}><ChevronLeft size={16} /></button><button className="btn size-9 p-0" aria-label="Next page" disabled={!data?.nextCursor} onClick={() => { setHistory((items) => [...items, cursor]); setCursor(data?.nextCursor ?? null); }}><ChevronRight size={16} /></button></div></footer>
    </section><ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={() => void queryClient.invalidateQueries({ queryKey: ["customers"] })} /></div>;
}
