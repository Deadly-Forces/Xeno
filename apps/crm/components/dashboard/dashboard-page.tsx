"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  ContactRound,
  Megaphone,
  MousePointerClick,
  Radio,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getDashboard, type DashboardData } from "@/components/dashboard/api";

const channels = ["ALL", "EMAIL", "SMS", "WHATSAPP", "RCS"];
const formatMoney = (value: number): string =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);

export default function DashboardPage(): JSX.Element {
  const [range, channel] =
    typeof window === "undefined"
      ? ["30", "ALL"]
      : [
          new URLSearchParams(window.location.search).get("range") ?? "30",
          new URLSearchParams(window.location.search).get("channel") ?? "ALL",
        ];
  const { data, isLoading, isError, refetch } = useQuery<DashboardData>({
    queryKey: ["dashboard", range, channel],
    queryFn: () => getDashboard(range, channel),
  });
  const updateFilter = (key: string, value: string): void => {
    const params = new URLSearchParams(window.location.search);
    params.set(key, value);
    window.location.search = params.toString();
  };
  if (isError)
    return (
      <section className="panel mx-auto max-w-xl p-8 text-center">
        <AlertTriangle className="mx-auto text-[#c8503b]" />
        <h1 className="mt-3 text-xl font-semibold">
          Dashboard data is unavailable
        </h1>
        <p className="mt-2 text-sm text-[#64716c]">
          The reporting service did not return a usable response.
        </p>
        <button className="btn btn-primary mt-5" onClick={() => void refetch()}>
          Try again
        </button>
      </section>
    );
  const metrics = [
    {
      key: "customers",
      label: "Customers",
      value: data?.metrics.customers.toLocaleString(),
      icon: ContactRound,
      note: "Known shopper profiles",
    },
    {
      key: "active",
      label: "Active campaigns",
      value: data?.metrics.active.toString(),
      icon: Megaphone,
      note: "In the selected period",
    },
    {
      key: "openRate",
      label: "Average open rate",
      value: data ? `${data.metrics.openRate}%` : undefined,
      icon: MousePointerClick,
      note: "Across billable sends",
    },
    {
      key: "conversions",
      label: "Conversions",
      value: data?.metrics.conversions.toLocaleString(),
      icon: ShoppingBag,
      note: "Commerce-attributed orders",
    },
  ];
  const maxFunnel = Math.max(1, data?.funnel.sent ?? 1);
  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label mb-2">Campaign command center</p>
          <h1 className="text-3xl font-semibold tracking-[-0.02em]">
            Campaign operations
          </h1>
          <p className="mt-1 text-sm text-[#64716c]">
            Performance, risk, cost, and live customer response.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Date range"
            className="input w-auto"
            value={range}
            onChange={(event) => updateFilter("range", event.target.value)}
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
          </select>
          <select
            aria-label="Channel"
            className="input w-auto"
            value={channel}
            onChange={(event) => updateFilter("channel", event.target.value)}
          >
            {channels.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
          <Link className="btn btn-primary" href="/campaigns/new">
            New campaign <ArrowUpRight size={16} />
          </Link>
        </div>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(({ key, label, value, icon: Icon, note }) => (
          <Card className="p-5" key={label}>
            <div className="mb-5 flex items-center justify-between">
              <span className="text-sm font-medium text-[#65736e]">
                {label}
              </span>
              <Icon size={18} className="text-accent" />
            </div>
            {isLoading ? (
              <>
                <Skeleton className="h-9 w-28" />
                <Skeleton className="mt-3 h-3 w-36" />
              </>
            ) : (
              <>
                <strong className="text-3xl font-semibold">
                  {value ?? "0"}
                </strong>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span
                    className={`inline-flex items-center gap-1 font-bold ${(data?.metrics.trends[key] ?? 0) >= 0 ? "text-accent" : "text-[#c8503b]"}`}
                  >
                    {(data?.metrics.trends[key] ?? 0) >= 0 ? (
                      <TrendingUp size={13} />
                    ) : (
                      <TrendingDown size={13} />
                    )}
                    {Math.abs(data?.metrics.trends[key] ?? 0)}%
                  </span>
                  <span className="text-[#7b8783]">vs previous period</span>
                </div>
                <p className="mt-2 text-xs text-[#7b8783]">{note}</p>
                <div className="mt-3 h-8">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data?.series.slice(-10) ?? []}>
                      <Area
                        type="monotone"
                        dataKey={
                          key === "openRate"
                            ? "opened"
                            : key === "active"
                              ? "sent"
                              : key === "customers"
                                ? "sent"
                                : "conversions"
                        }
                        stroke="#147d64"
                        fill="#dcefe8"
                        strokeWidth={2}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}
          </Card>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <article className="panel p-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold">Campaign performance</h2>
              <p className="text-xs text-[#71807a]">
                Sent, opened, and clicked over the selected period
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
              <Radio size={13} /> Live
            </span>
          </div>
          <div className="mt-5 h-72">
            {isLoading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.series ?? []}>
                  <defs>
                    <linearGradient id="sentFill" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="#147d64"
                        stopOpacity={0.28}
                      />
                      <stop offset="95%" stopColor="#147d64" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) => value.slice(5)}
                    fontSize={11}
                  />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="sent"
                    stroke="#147d64"
                    fill="url(#sentFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="opened"
                    stroke="#d7a33d"
                    fill="transparent"
                  />
                  <Area
                    type="monotone"
                    dataKey="clicked"
                    stroke="#d9674f"
                    fill="transparent"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
        <article className="panel p-5">
          <h2 className="font-semibold">Conversion funnel</h2>
          <p className="text-xs text-[#71807a]">
            Click a stage to inspect its relative drop-off
          </p>
          <div className="mt-5 space-y-3">
            {Object.entries(
              data?.funnel ?? {
                sent: 0,
                delivered: 0,
                opened: 0,
                clicked: 0,
                purchased: 0,
              },
            ).map(([label, count], index) => (
              <button key={label} className="group block w-full text-left">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-semibold capitalize">{label}</span>
                  <span>
                    {count.toLocaleString()} ·{" "}
                    {data?.funnel.sent
                      ? Math.round((count / data.funnel.sent) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="h-9 overflow-hidden rounded-md bg-[#eef2f0]">
                  <div
                    className="flex h-full items-center px-3 font-semibold text-white transition-all duration-500 group-hover:brightness-95"
                    style={{
                      width: `${Math.max(8, (count / maxFunnel) * 100)}%`,
                      background: [
                        "#147d64",
                        "#2d8f76",
                        "#d7a33d",
                        "#d9825f",
                        "#c8503b",
                      ][index],
                    }}
                  >
                    {index > 0 && data
                      ? `${Math.max(0, Math.round((1 - count / Math.max(1, Object.values(data.funnel)[index - 1] ?? 1)) * 100))}% drop`
                      : "Audience"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </article>
      </section>
      <section className="grid gap-4 lg:grid-cols-3">
        <article className="panel p-5">
          <h2 className="font-semibold">Revenue vs campaign cost</h2>
          <div className="mt-5 h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.series ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" hide />
                <YAxis fontSize={10} />
                <Tooltip formatter={(value: number) => formatMoney(value)} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#147d64"
                  fill="#dcefe8"
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#d9674f"
                  fill="#f7ddd7"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 flex justify-between text-sm">
            <span>
              Revenue <strong>{formatMoney(data?.metrics.revenue ?? 0)}</strong>
            </span>
            <span>
              Cost <strong>{formatMoney(data?.metrics.cost ?? 0)}</strong>
            </span>
          </div>
        </article>
        <article className="panel p-5">
          <h2 className="font-semibold">Leaders</h2>
          <div className="mt-5 space-y-4">
            <div className="rounded-md bg-[#eef7f3] p-4">
              <span className="label">Top campaign</span>
              <strong className="mt-2 block">
                {data?.topCampaign?.name ?? "No conversion data"}
              </strong>
              <p className="mt-1 text-xs text-[#64716c]">
                {data?.topCampaign
                  ? `${formatMoney(data.topCampaign.revenue)} from ${data.topCampaign.conversions} orders`
                  : "Launch a campaign to establish a leader."}
              </p>
            </div>
            <div className="rounded-md bg-[#f7f3e8] p-4">
              <span className="label">Top segment</span>
              <strong className="mt-2 block">
                {data?.topSegment ?? "No segment data"}
              </strong>
              <p className="mt-1 text-xs text-[#64716c]">
                Ranked by attributed campaign revenue
              </p>
            </div>
          </div>
        </article>
        <article className="panel p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={17} className="text-[#d17b32]" />
            <h2 className="font-semibold">Needs attention</h2>
          </div>
          <div className="mt-4 divide-y divide-line">
            {data?.needsAttention.length ? (
              data.needsAttention.map((item) => (
                <div key={item.id} className="py-3">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm">{item.title}</strong>
                    <span
                      className={`size-2 rounded-full ${item.severity === "critical" ? "bg-[#c8503b]" : "bg-[#d7a33d]"}`}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[#71807a]">{item.source}</p>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-[#71807a]">
                No open failures or drift alerts.
              </p>
            )}
          </div>
        </article>
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="panel overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <div>
              <h2 className="font-semibold">Recent campaigns</h2>
              <p className="text-xs text-[#7b8783]">
                Latest activity across every channel
              </p>
            </div>
            <Link
              href="/analytics"
              className="text-sm font-semibold text-accent"
            >
              View analytics
            </Link>
          </div>
          <div className="divide-y divide-line">
            {isLoading ? (
              Array.from({ length: 4 }, (_, index) => (
                <div className="p-5" key={index}>
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="mt-2 h-3 w-28" />
                </div>
              ))
            ) : data?.campaigns.length ? (
              data.campaigns.map((campaign) => (
                <Link
                  href={`/campaigns/${campaign.id}`}
                  key={campaign.id}
                  className="grid gap-2 px-5 py-4 hover:bg-[#f8faf9] sm:grid-cols-[1fr_110px_110px_100px] sm:items-center"
                >
                  <div>
                    <strong className="text-sm">{campaign.name}</strong>
                    <p className="text-xs text-[#7b8783]">
                      {campaign.segment.name}
                    </p>
                  </div>
                  <span className="text-sm">{campaign.channel}</span>
                  <span className="text-sm">
                    {new Date(campaign.createdAt).toLocaleDateString()}
                  </span>
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${campaign.status === "FAILED" ? "bg-[#f9e4df] text-[#a53c2b]" : "bg-[#e7f3ee] text-accent"}`}
                  >
                    {campaign.status}
                  </span>
                </Link>
              ))
            ) : (
              <p className="p-8 text-center text-sm text-[#71807a]">
                No campaigns in this period.
              </p>
            )}
          </div>
        </article>
        <article className="panel p-5">
          <h2 className="font-semibold">Activity timeline</h2>
          <div className="mt-5 space-y-4">
            {data?.activity.length ? (
              data.activity.map((item) => (
                <div
                  className="relative border-l border-line pl-5"
                  key={item.id}
                >
                  <span className="absolute -left-1 top-1 size-2 rounded-full bg-accent" />
                  <strong className="block text-sm capitalize">
                    {item.action}
                  </strong>
                  <p className="text-xs text-[#64716c]">
                    {item.entityType} · {item.actorEmail}
                  </p>
                  <time className="text-[11px] text-[#8a9591]">
                    {new Date(item.createdAt).toLocaleString()}
                  </time>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#71807a]">
                No operator or campaign activity yet.
              </p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
