"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  Download,
  FlaskConical,
  Mail,
  Pause,
  Play,
  Radio,
  ShieldCheck,
  Smartphone,
} from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Stats = {
  campaign: {
    name: string;
    status: string;
    channel: string;
    messageTemplate: string;
    failureReason: string | null;
    maxBudget: number | null;
    failureRateThreshold: number;
    minimumConversionRate: number;
    guardrailPaused: boolean;
    guardrailReason: string | null;
    chaosEnabled: boolean;
    chaosFailureRate: number;
    chaosLatencyMs: number;
    chaosDuplicateCallbacks: boolean;
    chaosOutOfOrderCallbacks: boolean;
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
  holdout: {
    recipients: number;
    conversions: number;
    contactedRate: number;
    holdoutRate: number;
    incrementalLift: number;
    confidence: number;
    liftLow: number;
    liftHigh: number;
  };
};

export default function CampaignDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [live, setLive] = useState<"connecting" | "live" | "polling">(
    "connecting",
  );

  const { data: session } = useQuery<{ user?: { role?: string } }>({
    queryKey: ["session"],
    queryFn: async () =>
      (await fetch("/api/auth/session")).json() as Promise<{
        user?: { role?: string };
      }>,
  });

  const { data, isLoading, isError, refetch } = useQuery<Stats>({
    queryKey: ["campaign", params.id],
    queryFn: async () => {
      const response = await fetch(
        `/api/campaigns/${params.id}/stats`,
      );
      if (!response.ok) throw new Error("Unable to load campaign");
      return response.json() as Promise<Stats>;
    },
    refetchInterval: () =>
      typeof document === "undefined" ||
      document.visibilityState === "visible"
        ? 8_000
        : false,
  });

  const control = useMutation({
    mutationFn: async (action: "pause" | "resume") => {
      const response = await fetch(
        `/api/campaigns/${params.id}/controls`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      if (!response.ok)
        throw new Error("Unable to update campaign controls");
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({
        queryKey: ["campaign", params.id],
      }),
  });

  useEffect(() => {
    let socket: WebSocket | undefined;
    let cancelled = false;
    void fetch("/api/realtime/token", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId: params.id }),
    })
      .then(
        async (response) =>
          response.json() as Promise<{ token?: string }>,
      )
      .then(({ token }) => {
        if (!token || cancelled) {
          setLive("polling");
          return;
        }
        const protocol =
          window.location.protocol === "https:" ? "wss" : "ws";
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
        <button
          className="btn btn-primary mt-5"
          onClick={() => void refetch()}
        >
          Retry
        </button>
      </section>
    );

  const counts = data.counts ?? {};
  const conversions = Number.isFinite(data.conversions)
    ? data.conversions
    : 0;
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

  const isGuardrailPaused = data.campaign.guardrailPaused;
  const isAdmin = session?.user?.role === "ADMIN";

  const controlButtonDisabled =
    control.isPending || (isGuardrailPaused && !isAdmin);

  const controlButtonLabel = isGuardrailPaused
    ? isAdmin
      ? "Approve resume"
      : "Admin approval required"
    : "Pause";

  const roiText = providerCost
    ? `${(((revenue - providerCost) / providerCost) * 100).toFixed(0)}% ROI`
    : "No billable sends yet";

  const largestDropStage = funnel
    .slice(1)
    .sort(
      (a, b) =>
        (funnel[funnel.indexOf(a) - 1]?.count ?? 0) -
        a.count -
        ((funnel[funnel.indexOf(b) - 1]?.count ?? 0) - b.count),
    )[0]
    ?.label.toLowerCase() ?? "delivery";

  const roiDisplayText = providerCost
    ? `${(((revenue - providerCost) / providerCost) * 100).toFixed(0)}%`
    : "not available until provider costs arrive";

  const analystText =
    sent === 0
      ? "Delivery has not started, so no performance " +
        "conclusion is justified yet."
      : conversions === 0
        ? `The campaign sent ${sent.toLocaleString()} messages ` +
          `with no attributed purchases. The largest measurable ` +
          `drop is ${largestDropStage}; wait for the attribution ` +
          `window before changing strategy.`
        : `The campaign produced ` +
          `${conversions.toLocaleString()} attributed conversions ` +
          `and $${revenue.toFixed(2)} revenue from ` +
          `${sent.toLocaleString()} sends. Actual ROI is ` +
          `${roiDisplayText}.`;

  const nextCampaignText = data.experiment?.result?.significant
    ? `reuse the ${data.experiment.result.winner.toLowerCase()} ` +
      `message and test channel timing.`
    : "keep the current control, extend the attribution window, " +
      "and collect a larger sample before selecting a winner.";

  const chaosDescription = data.campaign.chaosEnabled
    ? `${Math.round(data.campaign.chaosFailureRate * 100)}% ` +
      `injected failures · ${data.campaign.chaosLatencyMs}ms ` +
      `latency · ` +
      `${data.campaign.chaosDuplicateCallbacks ? "duplicate callbacks" : "no duplicates"}` +
      ` · ` +
      `${data.campaign.chaosOutOfOrderCallbacks ? "out-of-order callbacks" : "ordered callbacks"}`
    : "Disabled for this campaign.";

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label mb-2">{data.campaign.channel}</p>
          <h1 className="text-3xl font-semibold">
            {data.campaign.name}
          </h1>
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
        <div className="flex gap-2">
          <button
            className="btn"
            disabled={controlButtonDisabled}
            onClick={() =>
              control.mutate(
                isGuardrailPaused ? "resume" : "pause",
              )
            }
          >
            {isGuardrailPaused ? (
              <Play size={16} />
            ) : (
              <Pause size={16} />
            )}
            {controlButtonLabel}
          </button>
          <a
            className="btn"
            href={`/api/campaigns/${params.id}/export`}
            download
          >
            <Download size={16} />
            Export CSV
          </a>
        </div>
      </header>

      {isGuardrailPaused && (
        <section
          className={
            "flex items-start gap-3 rounded-md border " +
            "border-[#e4b8ad] bg-[#fff3f0] p-4 text-sm " +
            "text-[#8d3526]"
          }
        >
          <ShieldCheck className="shrink-0" size={19} />
          <div>
            <strong>Campaign paused by guardrail</strong>
            <p className="mt-1">
              {data.campaign.guardrailReason ??
                "Operator review required before delivery resumes."}
            </p>
          </div>
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Messages",
            value: Object.values(counts)
              .reduce((sum, count) => sum + count, 0)
              .toLocaleString(),
          },
          {
            label: "Conversions",
            value: conversions.toLocaleString(),
          },
          { label: "Revenue", value: `$${revenue.toFixed(2)}` },
          {
            label: "Provider cost / ROI",
            value: `$${providerCost.toFixed(2)}`,
            note: roiText,
          },
        ].map((metric) => (
          <article className="panel p-5" key={metric.label}>
            <span className="label">{metric.label}</span>
            <strong className="mt-2 block text-3xl">
              {metric.value}
            </strong>
            {metric.note && (
              <p className="text-xs text-[#71807a]">
                {metric.note}
              </p>
            )}
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <article className="panel p-5">
          <h2 className="font-semibold">
            Interactive conversion funnel
          </h2>
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
                    {sent
                      ? Math.round((stage.count / sent) * 100)
                      : 0}
                    %
                  </span>
                </div>
                <div className="h-11 rounded-md bg-[#edf2ef]">
                  <div
                    className={
                      "flex h-full items-center rounded-md " +
                      "px-3 text-xs font-bold text-white " +
                      "transition-all duration-500 " +
                      "group-hover:brightness-95"
                    }
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
            <div
              className={
                "mt-5 overflow-hidden rounded-lg border " +
                "border-line bg-white shadow-sm"
              }
            >
              <div
                className={
                  "border-b border-line bg-[#f5f7f5] " +
                  "px-4 py-3 text-xs"
                }
              >
                <strong>Northstar</strong>
                <p className="text-[#71807a]">
                  A personal offer for Maya
                </p>
              </div>
              <div className="p-5">
                <div className="mb-5 h-8 w-8 rounded-md bg-[#ef8e6e]" />
                <p className="text-sm leading-6">{message}</p>
                <button className="btn btn-primary mt-5">
                  Shop now
                </button>
              </div>
            </div>
          ) : (
            <div
              className={
                "mx-auto mt-5 max-w-[270px] rounded-[30px] " +
                "border-[7px] border-[#17201d] bg-[#edf3f0] " +
                "p-3 shadow-lg"
              }
            >
              <div
                className={
                  "mx-auto mb-4 h-1.5 w-16 rounded-full " +
                  "bg-[#17201d]"
                }
              />
              <div className="min-h-72 rounded-[20px] bg-white p-3">
                <p
                  className={
                    "mb-4 text-center text-[11px] " +
                    "font-semibold text-[#71807a]"
                  }
                >
                  Northstar · now
                </p>
                <div
                  className={
                    "ml-auto max-w-[90%] rounded-2xl " +
                    "rounded-br-sm bg-[#dcefe8] p-3 " +
                    "text-sm leading-5"
                  }
                >
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
            <strong className="mt-2 block text-3xl">
              {metric.value}
            </strong>
            <p className="text-xs text-[#71807a]">
              {metric.note}
            </p>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <article className="panel p-5">
          <div className="flex items-center gap-2">
            <Bot size={18} className="text-accent" />
            <h2 className="font-semibold">
              AI post-campaign analyst
            </h2>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#42554e]">
            {analystText}
          </p>
          <p className="mt-3 text-sm font-semibold">
            Next campaign: {nextCampaignText}
          </p>
          <div
            className={
              "mt-4 rounded-md bg-[#f2f5f3] p-3 " +
              "text-xs text-[#64716c]"
            }
          >
            Grounded in message states, conversion events,
            provider cost events, and experiment assignments
            shown on this page.
          </div>
        </article>

        <article className="panel p-5">
          <p className="label mb-2">No-send holdout</p>
          <h2 className="font-semibold">Incremental lift</h2>
          <strong className="mt-4 block text-3xl">
            {(data.holdout.incrementalLift * 100).toFixed(1)}%
          </strong>
          <p className="text-xs text-[#71807a]">
            {data.holdout.recipients} held out · 95% CI{" "}
            {(data.holdout.liftLow * 100).toFixed(1)} to{" "}
            {(data.holdout.liftHigh * 100).toFixed(1)} points
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-[#f2f5f3] p-3">
              <strong>
                {(data.holdout.contactedRate * 100).toFixed(2)}%
              </strong>
              <p className="text-xs text-[#71807a]">
                Contacted conversion
              </p>
            </div>
            <div className="rounded-md bg-[#f2f5f3] p-3">
              <strong>
                {(data.holdout.holdoutRate * 100).toFixed(2)}%
              </strong>
              <p className="text-xs text-[#71807a]">
                Holdout conversion
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="panel p-5">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-accent" />
            <h2 className="font-semibold">Adaptive guardrails</h2>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <span className="label">Budget</span>
              <strong className="mt-1 block">
                {data.campaign.maxBudget === null
                  ? "None"
                  : `$${data.campaign.maxBudget.toFixed(2)}`}
              </strong>
            </div>
            <div>
              <span className="label">Failure stop</span>
              <strong className="mt-1 block">
                {Math.round(
                  data.campaign.failureRateThreshold * 100,
                )}
                %
              </strong>
            </div>
            <div>
              <span className="label">Conversion floor</span>
              <strong className="mt-1 block">
                {(
                  data.campaign.minimumConversionRate * 100
                ).toFixed(1)}
                %
              </strong>
            </div>
          </div>
        </article>

        <article className="panel p-5">
          <div className="flex items-center gap-2">
            <FlaskConical
              size={18}
              className={
                data.campaign.chaosEnabled
                  ? "text-[#d9674f]"
                  : "text-[#71807a]"
              }
            />
            <h2 className="font-semibold">
              Channel-service chaos mode
            </h2>
          </div>
          <p className="mt-3 text-sm text-[#64716c]">
            {chaosDescription}
          </p>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        {data.experiment && (
          <article className="panel p-5">
            <div
              className={
                "flex flex-wrap items-start " +
                "justify-between gap-3"
              }
            >
              <div>
                <p className="label mb-2">
                  Randomized experiment
                </p>
                <h2 className="font-semibold">
                  {data.experiment.hypothesis}
                </h2>
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
                      <span className="text-[#71807a]">
                        Recipients
                      </span>
                    </div>
                    <div>
                      <strong className="block text-xl">
                        {variant.conversions}
                      </strong>
                      <span className="text-[#71807a]">
                        Conversions
                      </span>
                    </div>
                    <div>
                      <strong className="block text-xl">
                        ${variant.revenue.toFixed(0)}
                      </strong>
                      <span className="text-[#71807a]">
                        Revenue
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {data.experiment.result && (
              <div className="mt-4 rounded-md bg-[#f2f5f3] p-4 text-sm">
                <strong>
                  {data.experiment.result.upliftPercent.toFixed(1)}
                  % conversion uplift
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
                  {Math.round(
                    data.experiment.result.confidence * 100,
                  )}
                  % confidence.{" "}
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
                  <span
                    className={
                      "absolute -left-1 top-1 size-2 " +
                      "rounded-full bg-accent"
                    }
                  />
                  <strong className="block text-sm capitalize">
                    {event.label}
                  </strong>
                  <p className="text-xs text-[#64716c]">
                    {event.detail}
                  </p>
                  <time className="text-[11px] text-[#8a9591]">
                    {new Date(event.createdAt).toLocaleString()}
                  </time>
                </div>
              ))
            ) : (
              <p className="text-sm text-[#71807a]">
                No events recorded yet.
              </p>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}
