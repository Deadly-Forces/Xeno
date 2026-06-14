"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getAnalytics,
  getDecisioning,
  type AnalyticsData,
  type DecisioningData,
} from "@/components/analytics/api";

export default function AnalyticsPage(): JSX.Element {
  const [expanded, setExpanded] = useState<string | null>(null);
  const analytics = useQuery<AnalyticsData>({
    queryKey: ["analytics"],
    queryFn: getAnalytics,
  });
  const decision = useQuery<DecisioningData>({
    queryKey: ["decisioning"],
    queryFn: getDecisioning,
  });
  if (analytics.isError || decision.isError)
    return (
      <section className="panel mx-auto max-w-xl p-8 text-center">
        <AlertTriangle className="mx-auto text-[#c8503b]" />
        <h1 className="mt-3 text-xl font-semibold">
          Analytics could not be calculated
        </h1>
        <p className="mt-2 text-sm text-[#64716c]">
          Check the database and reporting service, then retry.
        </p>
        <button
          className="btn btn-primary mt-5"
          onClick={() => {
            void analytics.refetch();
            void decision.refetch();
          }}
        >
          Retry
        </button>
      </section>
    );
  const data = analytics.data;
  const decisioning = decision.data;
  const loading = analytics.isLoading || decision.isLoading;
  const funnel = (data?.channels ?? []).reduce(
    (total, row) => ({
      sent: total.sent + row.messages,
      delivered: total.delivered + row.delivered,
      opened: total.opened + row.opened,
      clicked: total.clicked + row.clicked,
    }),
    { sent: 0, delivered: 0, opened: 0, clicked: 0 },
  );
  const maxFunnel = Math.max(1, funnel.sent);
  return (
    <div className="space-y-6">
      <header>
        <p className="label mb-2">Performance and decision science</p>
        <h1 className="text-3xl font-semibold tracking-[-0.02em]">Analytics</h1>
        <p className="mt-1 text-sm text-[#64716c]">
          Campaign outcomes, model benchmarks, audience risk, and experiment
          maturity.
        </p>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Scored customers",
            value: decisioning?.audienceSize.toLocaleString(),
            note: `Model ${decisioning?.modelVersion ?? "-"}`,
          },
          {
            label: "Expected revenue",
            value: decisioning
              ? `$${decisioning.expectedRevenue.toFixed(0)}`
              : undefined,
            note: "Probability-weighted estimate",
          },
          {
            label: "High churn risk",
            value: decisioning?.highChurnRisk.toLocaleString(),
            note: "Risk score at or above 70%",
          },
          {
            label: "AI revenue uplift",
            value: decisioning
              ? `${decisioning.benchmark.uplift.revenuePercent.toFixed(0)}%`
              : undefined,
            note: `Top ${decisioning?.benchmark.selected ?? 0} vs seeded random`,
          },
        ].map((metric) => (
          <article className="panel p-5" key={metric.label}>
            <span className="label">{metric.label}</span>
            {loading ? (
              <Skeleton className="mt-3 h-9 w-28" />
            ) : (
              <strong className="mt-2 block text-3xl">
                {metric.value ?? "0"}
              </strong>
            )}
            <p className="mt-1 text-xs text-[#71807a]">{metric.note}</p>
          </article>
        ))}
      </section>
      <section className="grid gap-4 xl:grid-cols-[1.25fr_1fr]">
        <article className="panel p-5">
          <h2 className="font-semibold">Conversion and revenue trend</h2>
          <p className="text-xs text-[#71807a]">
            Commerce webhook attribution over 30 days
          </p>
          <div className="mt-5 h-72">
            {loading ? (
              <Skeleton className="h-full" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data?.timeSeries ?? []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(value: string) => value.slice(5)}
                    fontSize={11}
                  />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Legend />
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
            )}
          </div>
        </article>
        <article className="panel p-5">
          <h2 className="font-semibold">Delivery funnel</h2>
          <p className="text-xs text-[#71807a]">
            Aggregate progression across channels
          </p>
          <div className="mt-6 space-y-4">
            {Object.entries(funnel).map(([label, count], index) => (
              <div key={label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-semibold capitalize">{label}</span>
                  <span>
                    {count.toLocaleString()} ·{" "}
                    {Math.round((count / maxFunnel) * 100)}%
                  </span>
                </div>
                <div className="h-10 rounded-md bg-[#edf2ef]">
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{
                      width: `${Math.max(5, (count / maxFunnel) * 100)}%`,
                      backgroundColor: [
                        "#147d64",
                        "#2d8f76",
                        "#d7a33d",
                        "#d9674f",
                      ][index],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <article className="panel p-5">
          <div className="flex items-center gap-2">
            <Sparkles size={17} className="text-accent" />
            <h2 className="font-semibold">Decision model vs seeded random</h2>
          </div>
          <p className="mt-1 text-xs text-[#71807a]">
            Offline comparison, not a causal claim
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-[#b9d9ca] bg-[#eef7f3] p-5">
              <span className="label">Decision model</span>
              <strong className="mt-2 block text-3xl">
                {decisioning
                  ? `${(decisioning.benchmark.ai.precision * 100).toFixed(1)}%`
                  : "-"}
              </strong>
              <p className="text-xs text-[#64716c]">
                Precision · ${decisioning?.benchmark.ai.revenue.toFixed(0) ?? 0}{" "}
                observed revenue
              </p>
            </div>
            <div className="rounded-lg border border-line bg-[#f5f7f5] p-5">
              <span className="label">Seeded random</span>
              <strong className="mt-2 block text-3xl">
                {decisioning
                  ? `${(decisioning.benchmark.random.precision * 100).toFixed(1)}%`
                  : "-"}
              </strong>
              <p className="text-xs text-[#64716c]">
                Precision · $
                {decisioning?.benchmark.random.revenue.toFixed(0) ?? 0} observed
                revenue
              </p>
            </div>
          </div>
          <div className="mt-4 rounded-md bg-[#102a24] p-4 text-white">
            <strong>
              {decisioning?.benchmark.uplift.precisionPercent.toFixed(1) ?? 0}%
              precision delta
            </strong>
            <span className="ml-2 text-sm text-[#b9d3c9]">
              Validate through randomized live experiments before scaling spend.
            </span>
          </div>
        </article>
        <article className="panel p-5">
          <h2 className="font-semibold">Churn-risk distribution</h2>
          <p className="text-xs text-[#71807a]">
            Population density by risk band
          </p>
          <div className="mt-6 grid grid-cols-4 gap-2">
            {data?.churnDistribution.map((bucket, index) => (
              <div key={bucket.label} className="text-center">
                <div className="grid h-36 place-items-end overflow-hidden rounded-md bg-[#edf2ef]">
                  <div
                    className="w-full transition-all duration-500"
                    style={{
                      height: `${Math.max(8, (bucket.customers / Math.max(1, ...data.churnDistribution.map((item) => item.customers))) * 100)}%`,
                      backgroundColor: [
                        "#78b99f",
                        "#d7c06b",
                        "#dd8b62",
                        "#c8503b",
                      ][index],
                    }}
                  />
                </div>
                <strong className="mt-2 block text-lg">
                  {bucket.customers}
                </strong>
                <span className="text-[11px] text-[#64716c]">
                  {bucket.label}
                </span>
              </div>
            ))}
          </div>
        </article>
      </section>
      <section className="panel overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-semibold">Customer recommendations</h2>
          <p className="text-xs text-[#71807a]">
            Expand a row to inspect every frozen decision reason.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-[#f2f5f3] text-xs uppercase text-[#66736e]">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th>Score</th>
                <th>Expected revenue</th>
                <th>Churn</th>
                <th>Channel / hour</th>
                <th>Decision reasons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {decisioning?.recommendations.slice(0, 12).map((item) => (
                <tr key={item.customerId} className="align-top">
                  <td className="px-5 py-4 font-semibold">{item.name}</td>
                  <td className="py-4">{item.decisionScore.toFixed(1)}</td>
                  <td className="py-4">${item.expectedRevenue.toFixed(2)}</td>
                  <td className="py-4">{Math.round(item.churnRisk * 100)}%</td>
                  <td className="py-4">
                    {item.recommendedChannel} at {item.recommendedSendHour}:00
                  </td>
                  <td className="max-w-sm py-4 pr-5">
                    <button
                      className="flex w-full items-start justify-between gap-3 text-left text-[#64716c]"
                      onClick={() =>
                        setExpanded(
                          expanded === item.customerId ? null : item.customerId,
                        )
                      }
                    >
                      <span>
                        {expanded === item.customerId
                          ? item.reasons.join(" · ")
                          : item.reasons[0]}
                      </span>
                      {expanded === item.customerId ? (
                        <ChevronUp size={15} />
                      ) : (
                        <ChevronDown size={15} />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-5">
          <h2 className="font-semibold">Experiment sample progress</h2>
          <div className="mt-4 space-y-5">
            {data?.experiments.length ? (
              data.experiments.map((experiment) => (
                <div key={experiment.id}>
                  <div className="flex justify-between gap-4 text-sm">
                    <strong className="line-clamp-1">
                      {experiment.hypothesis}
                    </strong>
                    <span>
                      {experiment.recipients}/{experiment.target}
                    </span>
                  </div>
                  <div className="mt-2 h-2 rounded-full bg-[#e7ece9]">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-500"
                      style={{ width: `${experiment.progress}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[#71807a]">
                    {experiment.progress}% sampled · {experiment.conversions}{" "}
                    conversions · {experiment.status}
                  </p>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-sm text-[#71807a]">
                No experiments have started.
              </p>
            )}
          </div>
        </article>
        <article className="panel p-5">
          <h2 className="font-semibold">Channel performance</h2>
          <div className="mt-5 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.channels ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="channel" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="delivered" fill="#147d64" />
                <Bar dataKey="opened" fill="#d7a33d" />
                <Bar dataKey="clicked" fill="#d9674f" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    </div>
  );
}
