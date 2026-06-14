"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Check,
  Mail,
  MessageCircle,
  Save,
  Send,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AIChatSidebar } from "../../../components/ai/ai-chat-sidebar";
import { useToast } from "../../../components/ui/toast";

type Segment = {
  id: string;
  name: string;
  description: string;
  customerCount: number;
};
type Preview = {
  count: number;
  customers: Array<{
    id: string;
    name: string;
    city: string;
    totalOrderValue: string;
    channelPreference: string;
  }>;
};
const channels = [
  { value: "WHATSAPP", icon: MessageCircle },
  { value: "SMS", icon: Send },
  { value: "EMAIL", icon: Mail },
  { value: "RCS", icon: MessageCircle },
] as const;
type Channel = (typeof channels)[number]["value"];

function isChannel(value: string): value is Channel {
  return channels.some((item) => item.value === value);
}

export default function NewCampaignPage(): JSX.Element {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { notify } = useToast();
  const [step, setStep] = useState(1);
  const [segmentId, setSegmentId] = useState("");
  const [channel, setChannel] = useState<Channel>("WHATSAPP");
  const [name, setName] = useState("Personalized re-engagement");
  const [message, setMessage] = useState(
    "Hi {{name}}, we saved something special for you. Revisit {{lastProduct}} today.",
  );
  const [scheduleMode, setScheduleMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [experimentEnabled, setExperimentEnabled] = useState(true);
  const [hypothesis, setHypothesis] = useState(
    "A benefit-led AI message will increase conversion rate versus the standard message.",
  );
  const [treatmentMessage, setTreatmentMessage] = useState(
    "Hi {{name}}, based on your interest in {{lastProduct}}, this offer was selected for you. Shop before it expires.",
  );
  const [scoreTargeting, setScoreTargeting] = useState(true);
  const [targetPercentage, setTargetPercentage] = useState(30);
  const [recommendedChannel, setRecommendedChannel] = useState(true);
  const [recommendedTime, setRecommendedTime] = useState(true);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [validationError, setValidationError] = useState("");
  const { data: segments = [] } = useQuery<Segment[]>({
    queryKey: ["segments"],
    queryFn: async () =>
      (await fetch("/api/segments")).json() as Promise<Segment[]>,
  });
  const selected = segments.find((segment) => segment.id === segmentId);
  const { data: preview } = useQuery<Preview>({
    queryKey: ["segment-preview", segmentId],
    enabled: Boolean(segmentId),
    queryFn: async () => {
      const response = await fetch(`/api/segments/${segmentId}/preview`);
      if (!response.ok) throw new Error("Unable to preview segment");
      return response.json() as Promise<Preview>;
    },
  });
  useEffect(() => {
    if (selected) setName(`${selected.name} campaign`);
  }, [selected]);
  useEffect(() => {
    const raw = window.localStorage.getItem("xeno-campaign-draft");
    if (!raw) return;
    try {
      const draft = JSON.parse(raw) as {
        segmentId?: string;
        channel?: string;
        name?: string;
        message?: string;
        treatmentMessage?: string;
        hypothesis?: string;
        targetPercentage?: number;
      };
      if (draft.segmentId) setSegmentId(draft.segmentId);
      if (draft.channel && isChannel(draft.channel)) setChannel(draft.channel);
      if (draft.name) setName(draft.name);
      if (draft.message) setMessage(draft.message);
      if (draft.treatmentMessage) setTreatmentMessage(draft.treatmentMessage);
      if (draft.hypothesis) setHypothesis(draft.hypothesis);
      if (draft.targetPercentage) setTargetPercentage(draft.targetPercentage);
    } catch {
      window.localStorage.removeItem("xeno-campaign-draft");
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.localStorage.setItem(
        "xeno-campaign-draft",
        JSON.stringify({
          segmentId,
          channel,
          name,
          message,
          treatmentMessage,
          hypothesis,
          targetPercentage,
        }),
      );
      setSavedAt(new Date());
    }, 500);
    return () => window.clearTimeout(timer);
  }, [
    segmentId,
    channel,
    name,
    message,
    treatmentMessage,
    hypothesis,
    targetPercentage,
  ]);
  const baseReach = preview?.count ?? selected?.customerCount ?? 0;
  const eligibleReach = Math.round(
    baseReach * 0.92 * (scoreTargeting ? targetPercentage / 100 : 1),
  );
  const estimatedCost =
    eligibleReach *
    (channel === "EMAIL" ? 0.006 : channel === "SMS" ? 0.018 : 0.012);
  const estimatedRevenue = eligibleReach * 0.035 * 48;
  const estimatedRoi = estimatedCost
    ? ((estimatedRevenue - estimatedCost) / estimatedCost) * 100
    : 0;
  function continueStep(): void {
    const error =
      step === 1 && !segmentId
        ? "Select an audience before continuing."
        : step === 2 && name.trim().length < 3
          ? "Campaign name must contain at least three characters."
          : step === 2 && message.trim().length < 10
            ? "Control message is too short."
            : step === 2 &&
                experimentEnabled &&
                (hypothesis.trim().length < 10 ||
                  treatmentMessage.trim().length < 10)
              ? "Complete the experiment hypothesis and treatment message."
              : "";
    setValidationError(error);
    if (!error) setStep((current) => Math.min(4, current + 1));
  }
  const create = useMutation({
    mutationFn: async () => {
      setSubmitError("");
      const createResponse = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          segmentId,
          channel,
          messageTemplate: message,
          scheduledAt:
            scheduleMode === "later" && scheduledAt
              ? new Date(scheduledAt).toISOString()
              : null,
          aiGenerated: false,
          targetingMode: scoreTargeting ? "SCORE_TOP_PERCENT" : "ALL",
          targetPercentage: scoreTargeting ? targetPercentage : 100,
          useRecommendedChannel: recommendedChannel,
          useRecommendedSendTime: recommendedTime,
          experiment: experimentEnabled
            ? {
                hypothesis,
                treatmentTemplate: treatmentMessage,
                controlAllocation: 50,
              }
            : undefined,
        }),
      });
      const campaign = (await createResponse.json()) as {
        id?: string;
        error?: string;
      };
      if (!createResponse.ok || !campaign.id)
        throw new Error(campaign.error ?? "Unable to create campaign");
      queryClient.setQueryData(["campaign", campaign.id], {
        campaign: {
          name,
          status: "RUNNING",
          channel,
          messageTemplate: message,
          failureReason: null,
        },
        counts: { QUEUED: preview?.count ?? selected?.customerCount ?? 0 },
        conversions: 0,
        revenue: 0,
        providerCost: 0,
        decisioning: {
          averageScore: 0,
          averageChurnRisk: 0,
          expectedRevenue: 0,
        },
        timeline: [],
        experiment: null,
      });
      const launchResponse = await fetch(
        `/api/campaigns/${campaign.id}/launch`,
        { method: "POST" },
      );
      const launched = (await launchResponse.json()) as { error?: string };
      if (!launchResponse.ok)
        throw new Error(launched.error ?? "Campaign launch failed");
      await queryClient.invalidateQueries({
        queryKey: ["campaign", campaign.id],
      });
      return { id: campaign.id };
    },
    onSuccess: (campaign) => {
      window.localStorage.removeItem("xeno-campaign-draft");
      notify({
        tone: "success",
        title:
          scheduleMode === "later" ? "Campaign scheduled" : "Campaign launched",
        message: `${name} is now being processed.`,
      });
      router.push(`/campaigns/${campaign.id}`);
    },
    onError: (error) => {
      const message =
        error instanceof Error ? error.message : "Campaign launch failed";
      setSubmitError(message);
      notify({ tone: "error", title: "Campaign launch failed", message });
    },
  });
  return (
    <div className="space-y-6 pb-20">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="label mb-2">Campaign builder</p>
          <h1 className="text-3xl font-semibold">Create campaign</h1>
        </div>
        <span className="inline-flex items-center gap-2 text-xs text-[#71807a]">
          <Save size={14} className="text-accent" />
          {savedAt
            ? `Draft saved ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : "Saving draft"}
        </span>
        <div className="basis-full mt-3 flex flex-wrap gap-2">
          {["Audience", "Message", "Review", "Launch"].map((label, index) => (
            <div
              key={label}
              className={`flex items-center gap-2 text-sm ${step >= index + 1 ? "font-semibold text-accent" : "text-[#8a9591]"}`}
            >
              <span
                className={`grid size-6 place-items-center rounded-full border ${step > index + 1 ? "border-accent bg-accent text-white" : "border-current"}`}
              >
                {step > index + 1 ? <Check size={13} /> : index + 1}
              </span>
              {label}
              {index < 3 && <span className="mx-2 h-px w-10 bg-line" />}
            </div>
          ))}
        </div>
      </header>
      <div className="grid overflow-hidden rounded-lg border border-line bg-white lg:grid-cols-[minmax(0,1fr)_390px]">
        <section className="min-h-[600px] p-7">
          {step === 1 && (
            <div>
              <h2 className="text-lg font-semibold">Choose an audience</h2>
              <p className="mb-5 text-sm text-[#71807a]">
                Select the segment this campaign should reach.
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {segments.map((segment) => (
                  <button
                    onClick={() => setSegmentId(segment.id)}
                    key={segment.id}
                    className={`rounded-md border p-4 text-left ${segmentId === segment.id ? "border-accent bg-[#f0f8f5]" : "border-line"}`}
                  >
                    <strong className="text-sm">{segment.name}</strong>
                    <p className="mt-1 text-xs text-[#71807a]">
                      {segment.description}
                    </p>
                    <span className="mt-4 block text-lg font-semibold">
                      {segment.customerCount}
                    </span>
                    <span className="text-xs text-[#71807a]">
                      estimated recipients
                    </span>
                  </button>
                ))}
              </div>
              {preview && (
                <div className="mt-5">
                  <span className="label">Sample customers</span>
                  <div className="mt-2 divide-y divide-line rounded-md border border-line">
                    {preview.customers.slice(0, 5).map((customer) => (
                      <div
                        key={customer.id}
                        className="grid grid-cols-[1fr_120px_100px] px-3 py-2 text-sm"
                      >
                        <span>{customer.name}</span>
                        <span className="text-[#71807a]">{customer.city}</span>
                        <strong>
                          ${Number(customer.totalOrderValue).toFixed(0)}
                        </strong>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          {step === 2 && (
            <div className="space-y-5">
              <div>
                <label className="label">Campaign name</label>
                <input
                  aria-label="Campaign name"
                  className="input mt-1"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <div>
                <label className="label">Channel</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {channels.map(({ value, icon: Icon }) => (
                    <button
                      className={`btn ${channel === value ? "border-accent bg-[#eef7f3] text-accent" : ""}`}
                      key={value}
                      onClick={() => setChannel(value)}
                    >
                      <Icon size={15} />
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Control message</label>
                <textarea
                  aria-label="Control message"
                  className="input mt-1 min-h-32 resize-none"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                />
                <p className="mt-1 text-xs text-[#7b8783]">
                  Available variables: {"{{name}}"}, {"{{lastProduct}}"}
                </p>
              </div>
              <div className="rounded-md border border-line bg-[#f8faf9] p-4">
                <label className="flex items-center gap-3 text-sm font-semibold">
                  <input
                    aria-label="Run randomized A/B experiment"
                    type="checkbox"
                    checked={experimentEnabled}
                    onChange={(event) =>
                      setExperimentEnabled(event.target.checked)
                    }
                  />{" "}
                  Run randomized A/B experiment
                </label>
                {experimentEnabled && (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="label">Hypothesis</label>
                      <input
                        aria-label="Experiment hypothesis"
                        className="input mt-1"
                        value={hypothesis}
                        onChange={(event) => setHypothesis(event.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label">AI treatment message</label>
                      <textarea
                        aria-label="AI treatment message"
                        className="input mt-1 min-h-28 resize-none"
                        value={treatmentMessage}
                        onChange={(event) =>
                          setTreatmentMessage(event.target.value)
                        }
                      />
                    </div>
                    <p className="text-xs text-[#71807a]">
                      Recipients are assigned 50/50 using a stable hash,
                      preventing allocation drift during retries.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          {step === 3 && (
            <div>
              <h2 className="text-lg font-semibold">Review campaign</h2>
              <p className="mt-1 text-sm text-[#71807a]">
                Estimates update as targeting and channel settings change.
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Eligible reach",
                    value: eligibleReach.toLocaleString(),
                    note: `${baseReach - eligibleReach} overlap, suppression, or score exclusions`,
                  },
                  {
                    label: "Estimated cost",
                    value: `$${estimatedCost.toFixed(2)}`,
                    note: `${channel} provider estimate`,
                  },
                  {
                    label: "Estimated revenue",
                    value: `$${estimatedRevenue.toFixed(0)}`,
                    note: "3.5% conversion assumption",
                  },
                  {
                    label: "Estimated ROI",
                    value: `${estimatedRoi.toFixed(0)}%`,
                    note: "Revenue less delivery cost",
                  },
                ].map((metric) => (
                  <div
                    className="rounded-md bg-[#f2f5f3] p-4"
                    key={metric.label}
                  >
                    <span className="label">{metric.label}</span>
                    <strong className="mt-2 block text-2xl">
                      {metric.value}
                    </strong>
                    <p className="mt-1 text-xs text-[#71807a]">{metric.note}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="rounded-md border border-line p-5">
                  <span className="label">Control</span>
                  <p className="mt-3 text-sm leading-6">
                    {message
                      .replace("{{name}}", "Maya")
                      .replace("{{lastProduct}}", "Vitamin C Serum")}
                  </p>
                </div>
                {experimentEnabled && (
                  <div className="rounded-md border border-accent bg-[#f0f8f5] p-5">
                    <span className="label">AI treatment</span>
                    <p className="mt-3 text-sm leading-6">
                      {treatmentMessage
                        .replace("{{name}}", "Maya")
                        .replace("{{lastProduct}}", "Vitamin C Serum")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
          {step === 4 && (
            <div>
              <h2 className="text-lg font-semibold">Dispatch timing</h2>
              <div className="mt-5 flex gap-2">
                <button
                  className={`btn ${scheduleMode === "now" ? "border-accent bg-[#eef7f3] text-accent" : ""}`}
                  onClick={() => setScheduleMode("now")}
                >
                  <Send size={15} /> Launch now
                </button>
                <button
                  className={`btn ${scheduleMode === "later" ? "border-accent bg-[#eef7f3] text-accent" : ""}`}
                  onClick={() => setScheduleMode("later")}
                >
                  <CalendarClock size={15} /> Schedule
                </button>
              </div>
              {scheduleMode === "later" && (
                <div className="mt-4 max-w-sm">
                  <label className="label">Send date and time</label>
                  <input
                    aria-label="Send date and time"
                    className="input mt-1"
                    type="datetime-local"
                    min={new Date().toISOString().slice(0, 16)}
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                </div>
              )}
              <div className="mt-5 space-y-3 rounded-md border border-line bg-[#f8faf9] p-4">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    aria-label="Send only to top-scored customers"
                    type="checkbox"
                    checked={scoreTargeting}
                    onChange={(event) =>
                      setScoreTargeting(event.target.checked)
                    }
                  />{" "}
                  Send only to top-scored customers
                </label>
                {scoreTargeting && (
                  <label className="block text-sm">
                    Top {targetPercentage}%
                    <input
                      aria-label="Top-scored customer percentage"
                      className="mt-2 w-full accent-[#147d64]"
                      type="range"
                      min="5"
                      max="100"
                      step="5"
                      value={targetPercentage}
                      onChange={(event) =>
                        setTargetPercentage(Number(event.target.value))
                      }
                    />
                  </label>
                )}
                <label className="flex items-center gap-2 text-sm">
                  <input
                    aria-label="Automatically apply recommended channel"
                    type="checkbox"
                    checked={recommendedChannel}
                    onChange={(event) =>
                      setRecommendedChannel(event.target.checked)
                    }
                  />{" "}
                  Automatically apply recommended channel
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    aria-label="Automatically apply per-customer send hour"
                    type="checkbox"
                    checked={recommendedTime}
                    onChange={(event) =>
                      setRecommendedTime(event.target.checked)
                    }
                  />{" "}
                  Automatically apply per-customer send hour
                </label>
              </div>
              <p className="mt-5 max-w-lg text-sm text-[#71807a]">
                Opt-outs, suppressions, and weekly frequency caps are enforced
                before jobs are created.
              </p>
              {submitError && (
                <p className="mt-3 text-sm text-red-700">{submitError}</p>
              )}
              <button
                onClick={() => create.mutate()}
                disabled={
                  create.isPending || (scheduleMode === "later" && !scheduledAt)
                }
                className="btn btn-primary mt-6"
              >
                <Send size={16} />
                {create.isPending
                  ? "Preparing..."
                  : scheduleMode === "later"
                    ? "Schedule campaign"
                    : "Launch now"}
              </button>
            </div>
          )}
          {validationError && (
            <p className="mt-5 rounded-md bg-[#f9e4df] p-3 text-sm text-[#a53c2b]">
              {validationError}
            </p>
          )}
        </section>
        <AIChatSidebar
          onDraft={(draft) => {
            if (draft.template) setMessage(draft.template);
            if (isChannel(draft.channel)) setChannel(draft.channel);
            setStep(2);
          }}
          onRecommendation={(recommended) => {
            if (isChannel(recommended)) setChannel(recommended);
          }}
        />
      </div>
      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgb(16_42_36_/_8%)] backdrop-blur md:left-60">
        <div className="mx-auto flex max-w-[1436px] items-center justify-between">
          <div>
            <strong className="text-sm">Step {step} of 4</strong>
            <p className="text-xs text-[#71807a]">
              {savedAt ? "Draft autosaved" : "Saving changes"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn"
              disabled={step === 1}
              onClick={() => {
                setValidationError("");
                setStep((current) => Math.max(1, current - 1));
              }}
            >
              <ArrowLeft size={15} /> Back
            </button>
            {step < 4 && (
              <button className="btn btn-primary" onClick={continueStep}>
                Continue <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
