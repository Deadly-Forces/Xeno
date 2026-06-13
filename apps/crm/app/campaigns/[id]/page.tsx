"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, Mail, Radio, Smartphone } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "../../../components/ui/badge";
import { Skeleton } from "../../../components/ui/skeleton";

type Stats = {
  campaign: {
    name: string;
    status: string;
    channel: string;
    messageTemplate: string;
    failureReason: string | null;
  };
  counts: Record<string, number>;
  conversions: number;
  revenue: number;
  providerCost: number;
  decisioning: {
    averageScore: number;
    averageChurnRisk: number;
    expectedRevenue: number;
  };
  timeline: Array<{
    id: string;
    label: string;
    detail: string;
    createdAt: string;
  }>;
  experiment: null | {
    hypothesis: string;
    status: string;
    variants: Array<{
      kind: string;
      name: string;
      recipients: number;
      conversions: number;
      revenue: number;
    }>;
    result: null | {
      controlRate: number;
      treatmentRate: number;
      upliftPercent: number;
      confidence: number;
      significant: boolean;
      winner: string;
    };
  };
};

export default function CampaignDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [live, setLive] = useState<"connecting" | "live" | "polling">(
    "connecting",
  );
  const { data, isLoading, isError, refetch } = useQuery<Stats>({
    queryKey: ["campaign", params.id],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${params.id}/stats`);
      if (!response.ok) throw new Error("Unable to load campaign");
      return response.json() as Promise<Stats>;
    },
    refetchInterval: () =>
      document.visibilityState === "visible" ? 8_000 : false,
  });
  useEffect(() => {
    let socket: WebSocket | undefined;
    let cancelled = false;
    void fetch("/api/realtime/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId: params.id }),
    })
      .then(async (response) => response.json() as Promise<{ token?: string }>)
      .then(({ token }) => {
        if (!token || cancelled) {
          setLive("polling");
          return;
        }
        const protocol = window.location.protocol === "https:" ? "wss" : "ws";
        socket = new WebSocket(
          `${protocol}://${window.location.hostname}:3001?token=${encodeURIComponent(token)}`,
        );
        socket.onopen = () => setLive("live");
        socket.onerror = () => setLive("polling");
        socket.onclose = () => setLive("polling");
        socket.onmessage = () =>
          void queryClient.invalidateQueries({
            queryKey: ["campaign", params.id],
          });
      })
      .catch(() => setLive("polling"));
    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [params.id, queryClient]);
  if (isLoading)
    return (
      <div className="space-y-6">
        <Skeleton className="h-24" />
        <section className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton className="h-32" key={index} />
          ))}
        </section>
        <Skeleton className="h-96" />
      </div>
    );
  if (isError || !data)
    return (
      <section className="panel mx-auto max-w-xl p-8 text-center">
        <AlertTriangle className="mx-auto text-[#c8503b]" />
        <h1 className="mt-3 text-xl font-semibold">
          Campaign data is unavailable
        </h1>
        <button className="btn btn-primary mt-5" onClick={() => void refetch()}>
          Retry
        </button>
      </section>
    );
  const counts = data.counts ?? {};
  const conversions = Number.isFinite(data.conversions) ? data.conversions : 0;
  const revenue = Number.isFinite(data.revenue) ? data.revenue : 0;
  const providerCost = Number.isFinite(data.providerCost)
    ? data.providerCost
    : 0;
  const decisioning = data.decisioning ?? {
    averageScore: 0,
    averageChurnRisk: 0,
    expectedRevenue: 0,
  };
  const timeline = data.timeline ?? [];
  const sent = Object.entries(counts)
    .filter(([status]) => !["QUEUED", "FAILED"].includes(status))
    .reduce((sum, [, count]) => sum + count, 0);
  const funnel = [
    { label: "Sent", count: sent },
    {
      label: "Delivered",
      count: ["DELIVERED", "OPENED", "READ", "CLICKED"].reduce(
        (sum, status) => sum + (counts[status] ?? 0),
        0,
      ),
    },
    {
      label: "Opened",
      count: ["OPENED", "READ", "CLICKED"].reduce(
        (sum, status) => sum + (counts[status] ?? 0),
        0,
      ),
    },
    { label: "Clicked", count: counts.CLICKED ?? 0 },
    { label: "Purchased", count: conversions },
  ];
  const message = data.campaign.messageTemplate
    .replace("{{name}}", "Maya")
    .replace("{{lastProduct}}", "Vitamin C Serum");
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label mb-2">{data.campaign.channel}</p>
          <h1 className="text-3xl font-semibold">{data.campaign.name}</h1>
          <div className="mt-2 flex items-center gap-2">
            <Badge>{data.campaign.status}</Badge>
            <span
              className={`inline-flex items-center gap-1 text-xs font-semibold ${live === "live" ? "text-accent" : "text-[#d17b32]"}`}
            >
              <Radio size={13} />{" "}
              {live === "live"
                ? "WebSocket live"
                : live === "connecting"
                  ? "Connecting"
                  : "Polling fallback"}
            </span>
          </div>
          {data.campaign.failureReason ? (
            <p className="mt-2 text-sm text-red-700">
              {data.campaign.failureReason}
            </p>
          ) : null}
        </div>
        <a className="btn" href={`/api/campaigns/${params.id}/export`} download>
          <Download size={16} /> Export CSV
        </a>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Messages",
            value: Object.values(counts)
              .reduce((sum, count) => sum + count, 0)
              .toLocaleString(),
          },
          { label: "Conversions", value: conversions.toLocaleString() },
          { label: "Revenue", value: `$${revenue.toFixed(2)}` },
          {
            label: "Provider cost / ROI",
            value: `$${providerCost.toFixed(2)}`,
            note: providerCost
              ? `${(((revenue - providerCost) / providerCost) * 100).toFixed(0)}% ROI`
              : "No billable sends yet",
          },
        ].map((metric) => (
          <article className="panel p-5" key={metric.label}>
            <span className="label">{metric.label}</span>
            <strong className="mt-2 block text-3xl">{metric.value}</strong>
            {metric.note && (
              <p className="text-xs text-[#71807a]">{metric.note}</p>
            )}
          </article>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <article className="panel p-5">
          <h2 className="font-semibold">Interactive conversion funnel</h2>
          <p className="text-xs text-[#71807a]">
            Sent → Delivered → Opened → Clicked → Purchased
          </p>
          <div className="mt-6 space-y-3">
            {funnel.map((stage, index) => (
              <button
                key={stage.label}
                className="group block w-full text-left"
              >
                <div className="mb-1 flex justify-between text-xs">
                  <strong>{stage.label}</strong>
                  <span>
                    {stage.count.toLocaleString()} ·{" "}
                    {sent ? Math.round((stage.count / sent) * 100) : 0}%
                  </span>
                </div>
                <div className="h-11 rounded-md bg-[#edf2ef]">
                  <div
                    className="flex h-full items-center rounded-md px-3 text-xs font-bold text-white transition-all duration-500 group-hover:brightness-95"
                    style={{
                      width: `${Math.max(8, (stage.count / Math.max(1, sent)) * 100)}%`,
                      backgroundColor: [
                        "#147d64",
                        "#2d8f76",
                        "#d7a33d",
                        "#d9674f",
                        "#c8503b",
                      ][index],
                    }}
                  >
                    {index
                      ? `${Math.max(0, Math.round((1 - stage.count / Math.max(1, funnel[index - 1]?.count ?? 1)) * 100))}% drop`
                      : "100%"}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </article>
        <article className="panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Channel preview</h2>
            {data.campaign.channel === "EMAIL" ? (
              <Mail size={17} className="text-accent" />
            ) : (
              <Smartphone size={17} className="text-accent" />
            )}
          </div>
          {data.campaign.channel === "EMAIL" ? (
            <div className="mt-5 overflow-hidden rounded-lg border border-line bg-white shadow-sm">
              <div className="border-b border-line bg-[#f5f7f5] px-4 py-3 text-xs">
                <strong>Northstar</strong>
                <p className="text-[#71807a]">A personal offer for Maya</p>
              </div>
              <div className="p-5">
                <div className="mb-5 h-8 w-8 rounded-md bg-[#ef8e6e]" />
                <p className="text-sm leading-6">{message}</p>
                <button className="btn btn-primary mt-5">Shop now</button>
              </div>
            </div>
          ) : (
            <div className="mx-auto mt-5 max-w-[270px] rounded-[30px] border-[7px] border-[#17201d] bg-[#edf3f0] p-3 shadow-lg">
              <div className="mx-auto mb-4 h-1.5 w-16 rounded-full bg-[#17201d]" />
              <div className="min-h-72 rounded-[20px] bg-white p-3">
                <p className="mb-4 text-center text-[11px] font-semibold text-[#71807a]">
                  Northstar · now
                </p>
                <div className="ml-auto max-w-[90%] rounded-2xl rounded-br-sm bg-[#dcefe8] p-3 text-sm leading-5">
                  {message}
                </div>
              </div>
            </div>
          )}
        </article>
      </section>
      <section className="grid gap-4 md:grid-cols-3">
        {[
          {
            label: "Average decision score",
            value: decisioning.averageScore.toFixed(1),
            note: "Estimated conversion propensity",
          },
          {
            label: "Audience churn risk",
            value: `${Math.round(decisioning.averageChurnRisk * 100)}%`,
            note: "Explainable model estimate",
          },
          {
            label: "Expected revenue",
            value: `$${decisioning.expectedRevenue.toFixed(2)}`,
            note: "Pre-send model estimate",
          },
        ].map((metric) => (
          <article className="panel p-5" key={metric.label}>
            <span className="label">{metric.label}</span>
            <strong className="mt-2 block text-3xl">{metric.value}</strong>
            <p className="text-xs text-[#71807a]">{metric.note}</p>
          </article>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {data.experiment && (
          <article className="panel p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="label mb-2">Randomized experiment</p>
                <h2 className="font-semibold">{data.experiment.hypothesis}</h2>
              </div>
              <Badge>{data.experiment.status}</Badge>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {data.experiment.variants.map((variant) => (
                <div
                  key={variant.kind}
                  className="rounded-md border border-line p-4"
                >
                  <span className="label">{variant.name}</span>
                  <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
                    <div>
                      <strong className="block text-xl">
                        {variant.recipients}
                      </strong>
                      <span className="text-[#71807a]">Recipients</span>
                    </div>
                    <div>
                      <strong className="block text-xl">
                        {variant.conversions}
                      </strong>
                      <span className="text-[#71807a]">Conversions</span>
                    </div>
                    <div>
                      <strong className="block text-xl">
                        ${variant.revenue.toFixed(0)}
                      </strong>
                      <span className="text-[#71807a]">Revenue</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {data.experiment.result && (
              <div className="mt-4 rounded-md bg-[#f2f5f3] p-4 text-sm">
                <strong>
                  {data.experiment.result.upliftPercent.toFixed(1)}% conversion
                  uplift
                </strong>
                <div className="mt-3 h-2 rounded-full bg-[#dce3df]">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${Math.round(data.experiment.result.confidence * 100)}%`,
                    }}
                  />
                </div>
                <p className="mt-2 text-xs text-[#64716c]">
                  {Math.round(data.experiment.result.confidence * 100)}%
                  confidence.{" "}
                  {data.experiment.result.significant
                    ? `${data.experiment.result.winner} is statistically significant.`
                    : "More observations are required."}
                </p>
              </div>
            )}
          </article>
        )}
        <article className="panel p-5">
          <h2 className="font-semibold">Campaign activity</h2>
          <div className="mt-5 space-y-4">
            {timeline.length ? (
              timeline.map((event) => (
                <div
                  className="relative border-l border-line pl-5"
                  key={event.id}
                >
                  <span className="absolute -left-1 top-1 size-2 rounded-full bg-accent" />
                  <strong className="block text-sm capitalize">
                    {event.label}
                  </strong>
                  <p className="text-xs text-[#64716c]">{event.detail}</p>
                  <time className="text-[11px] text-[#8a9591]">
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#71807a]">No events recorded yet.</p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
