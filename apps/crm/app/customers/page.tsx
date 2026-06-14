"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Mail,
  MapPin,
  Phone,
  Search,
  ShoppingBag,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { ImportDialog } from "../../components/customers/import-dialog";
import { Drawer } from "../../components/ui/drawer";
import { Skeleton } from "../../components/ui/skeleton";

type Customer = {
  id: string;
  externalId: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string;
  ageGroup: string;
  gender: string;
  tags: string[];
  totalOrderValue: string;
  totalOrders: number;
  lastOrderAt: string | null;
  channelPreference: string;
  consentStatus: string;
  suppressedAt: string | null;
  suppressionReason: string | null;
  maxMessagesPerWeek: number;
};
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
  const [selected, setSelected] = useState<Customer | null>(null);
  const { data: segments = [] } = useQuery<Segment[]>({
    queryKey: ["segments", "customer-filter"],
    queryFn: async () =>
      (await fetch("/api/segments")).json() as Promise<Segment[]>,
  });
  const { data, isLoading, isError, refetch } = useQuery<CustomerPage>({
    queryKey: ["customers", query, segment, sort, direction, cursor],
    queryFn: async () => {
      const params = new URLSearchParams({
        q: query,
        limit: "25",
        sort,
        direction,
      });
      if (segment) params.set("segment", segment);
      if (cursor) params.set("cursor", cursor);
      const response = await fetch(`/api/customers?${params}`);
      if (!response.ok) throw new Error("Unable to load customers");
      return response.json() as Promise<CustomerPage>;
    },
  });
  function resetCursor(): void {
    setCursor(null);
    setHistory([]);
  }
  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <p className="label mb-2">Audience</p>
          <h1 className="text-3xl font-semibold">Customers</h1>
          <p className="mt-1 text-sm text-[#64716c]">
            Search, inspect, and import shopper profiles.
          </p>
        </div>
        <button className="btn" onClick={() => setImportOpen(true)}>
          <Upload size={16} /> Import
        </button>
      </header>
      <section className="panel overflow-hidden">
        <div className="grid grid-cols-[minmax(240px,1fr)_220px_180px_120px] gap-3 border-b border-line p-4">
          <div className="relative">
            <Search
              className="absolute left-3 top-2.5 text-[#7b8783]"
              size={16}
            />
            <input
              aria-label="Search customers"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                resetCursor();
              }}
              className="input pl-9"
              placeholder="Search name or email"
            />
          </div>
          <select
            aria-label="Filter by segment"
            className="input"
            value={segment}
            onChange={(event) => {
              setSegment(event.target.value);
              resetCursor();
            }}
          >
            <option value="">All segments</option>
            {segments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Sort customers by"
            className="input"
            value={sort}
            onChange={(event) => {
              setSort(event.target.value);
              resetCursor();
            }}
          >
            <option value="name">Name</option>
            <option value="totalOrderValue">Lifetime value</option>
            <option value="totalOrders">Order count</option>
            <option value="lastOrderAt">Last order</option>
          </select>
          <select
            aria-label="Sort direction"
            className="input"
            value={direction}
            onChange={(event) => {
              setDirection(event.target.value);
              resetCursor();
            }}
          >
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-[#f2f5f3] text-xs uppercase text-[#66736e]">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th>City</th>
                <th>Tags</th>
                <th>Orders</th>
                <th>Lifetime value</th>
                <th>Channel</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {isLoading ? (
                Array.from({ length: 6 }, (_, index) => (
                  <tr key={index}>
                    <td className="p-5" colSpan={6}>
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td className="p-8 text-center" colSpan={6}>
                    <AlertTriangle className="mx-auto text-[#c8503b]" />
                    <p className="mt-2 text-sm">
                      Customers could not be loaded.
                    </p>
                    <button className="btn mt-3" onClick={() => void refetch()}>
                      Retry
                    </button>
                  </td>
                </tr>
              ) : data?.customers.length ? (
                data.customers.map((customer) => (
                  <tr
                    tabIndex={0}
                    onClick={() => setSelected(customer)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") setSelected(customer);
                    }}
                    key={customer.id}
                    className="cursor-pointer hover:bg-[#eef7f3] focus:bg-[#eef7f3] focus:outline-none"
                  >
                    <td className="px-5 py-3">
                      <strong>{customer.name}</strong>
                      <div className="text-xs text-[#7b8783]">
                        {customer.email ?? customer.externalId}
                      </div>
                    </td>
                    <td>{customer.city}</td>
                    <td>
                      <div className="flex gap-1">
                        {customer.tags.slice(0, 2).map((tag) => (
                          <span
                            className="rounded bg-[#edf2ef] px-2 py-1 text-xs"
                            key={tag}
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>{customer.totalOrders}</td>
                    <td>${Number(customer.totalOrderValue).toFixed(2)}</td>
                    <td>{customer.channelPreference}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="p-10 text-center text-sm text-[#71807a]"
                  >
                    No customers match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <footer className="flex items-center justify-between border-t border-line px-4 py-3 text-xs text-[#71807a]">
          <span>{data?.customers.length ?? 0} customers on this page</span>
          <div className="flex gap-2">
            <button
              className="btn size-9 p-0"
              aria-label="Previous page"
              disabled={history.length === 0}
              onClick={() => {
                const previous = history.at(-1) ?? null;
                setHistory((items) => items.slice(0, -1));
                setCursor(previous);
              }}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              className="btn size-9 p-0"
              aria-label="Next page"
              disabled={!data?.nextCursor}
              onClick={() => {
                setHistory((items) => [...items, cursor]);
                setCursor(data?.nextCursor ?? null);
              }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </footer>
      </section>
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() =>
          void queryClient.invalidateQueries({ queryKey: ["customers"] })
        }
      />
      <Drawer
        open={Boolean(selected)}
        title="Customer profile"
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="space-y-6">
            <div>
              <div className="grid size-12 place-items-center rounded-full bg-[#e7f3ee] text-lg font-semibold text-accent">
                {selected.name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)}
              </div>
              <h2 className="mt-3 text-xl font-semibold">{selected.name}</h2>
              <p className="text-xs text-[#71807a]">{selected.externalId}</p>
            </div>
            <div className="space-y-3 text-sm">
              {selected.email && (
                <p className="flex items-center gap-2">
                  <Mail size={15} className="text-accent" />
                  {selected.email}
                </p>
              )}
              {selected.phone && (
                <p className="flex items-center gap-2">
                  <Phone size={15} className="text-accent" />
                  {selected.phone}
                </p>
              )}
              <p className="flex items-center gap-2">
                <MapPin size={15} className="text-accent" />
                {selected.city} · {selected.ageGroup}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md bg-[#f2f5f3] p-4">
                <ShoppingBag size={16} className="text-accent" />
                <strong className="mt-2 block text-2xl">
                  {selected.totalOrders}
                </strong>
                <span className="text-xs text-[#71807a]">Orders</span>
              </div>
              <div className="rounded-md bg-[#f2f5f3] p-4">
                <strong className="block text-2xl">
                  ${Number(selected.totalOrderValue).toFixed(0)}
                </strong>
                <span className="text-xs text-[#71807a]">Lifetime value</span>
              </div>
            </div>
            <div>
              <span className="label">Communication controls</span>
              <div className="mt-3 space-y-2 rounded-md border border-line p-4 text-sm">
                <div className="flex justify-between">
                  <span>Consent</span>
                  <strong
                    className={
                      selected.consentStatus === "OPTED_IN"
                        ? "text-accent"
                        : "text-[#c8503b]"
                    }
                  >
                    {selected.consentStatus}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span>Preferred channel</span>
                  <strong>{selected.channelPreference}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Weekly cap</span>
                  <strong>{selected.maxMessagesPerWeek}</strong>
                </div>
                {selected.suppressedAt && (
                  <p className="rounded bg-[#f9e4df] p-2 text-xs text-[#a53c2b]">
                    Suppressed:{" "}
                    {selected.suppressionReason ?? "No reason supplied"}
                  </p>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {selected.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#edf2ef] px-3 py-1 text-xs"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
