"use client";

import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, Bot, Check, ChevronRight, FlaskConical, Gauge, ListChecks, Loader2, PauseCircle, Play, Send, ShieldCheck, Sparkles, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/ui/toast";

type Plan = {
  intent: string;
  segment: { id: string; name: string; description: string; matched: number; eligible: number; rules: unknown };
  recommendation: { channel: "WHATSAPP" | "SMS" | "EMAIL" | "RCS"; sendHour: number; reasoning: string };
  copy: { control: string; treatment: string; hypothesis: string };
  estimates: { reach: number; holdout: number; excluded: number; unitCost: number; cost: number; revenue: number; roi: number; budget: number; withinBudget: boolean };
  included: Array<{ id: string; name: string; city: string; value: number; score: number; reasons: string[] }>;
  excluded: Array<{ id: string; name: string; reason: string }>;
  trace: Array<{ step: string; detail: string; source: string }>;
};

const tabs = ["Approval", "Audience", "Exclusions", "Decision trace"] as const;

export default function NewCampaignPage(): JSX.Element {
  const router = useRouter();
  const { notify } = useToast();
  const [intent, setIntent] = useState("Win back high-value shoppers who have not ordered in 60 days without exceeding $100.");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Approval");
  const [approved, setApproved] = useState(false);
  const [holdout, setHoldout] = useState(10);
  const [budget, setBudget] = useState(100);
  const [failureThreshold, setFailureThreshold] = useState(15);
  const [conversionFloor, setConversionFloor] = useState(1);
  const [chaosEnabled, setChaosEnabled] = useState(false);
  const [chaosFailure, setChaosFailure] = useState(5);
  const [chaosLatency, setChaosLatency] = useState(500);
  const [duplicateCallbacks, setDuplicateCallbacks] = useState(true);
  const [outOfOrder, setOutOfOrder] = useState(true);
  const [control, setControl] = useState("");
  const [treatment, setTreatment] = useState("");
  const budgetOkay = Boolean(plan && plan.estimates.cost <= budget);

  const generate = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/campaigns/autopilot/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intent }) });
      const result = await response.json() as Plan & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Autopilot could not build a plan");
      return result;
    },
    onSuccess: (result) => { setPlan(result); setBudget(result.estimates.budget); setHoldout(result.estimates.holdout ? Math.round(result.estimates.holdout / Math.max(1, result.segment.eligible) * 100) : 0); setControl(result.copy.control); setTreatment(result.copy.treatment); setApproved(false); },
    onError: (error) => notify({ tone: "error", title: "Planning failed", message: error instanceof Error ? error.message : "Unable to generate plan" })
  });

  const launch = useMutation({
    mutationFn: async () => {
      if (!plan || !approved) throw new Error("Explicit approval is required");
      const createResponse = await fetch("/api/campaigns", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({
        name: plan.segment.name.replace("Autopilot: ", ""), segmentId: plan.segment.id, channel: plan.recommendation.channel, messageTemplate: control, aiGenerated: true,
        targetingMode: "ALL", targetPercentage: 100, useRecommendedChannel: true, useRecommendedSendTime: true, holdoutPercentage: holdout, maxBudget: budget,
        failureRateThreshold: failureThreshold / 100, minimumConversionRate: conversionFloor / 100,
        chaosEnabled, chaosFailureRate: chaosFailure / 100, chaosLatencyMs: chaosLatency, chaosDuplicateCallbacks: duplicateCallbacks, chaosOutOfOrderCallbacks: outOfOrder,
        experiment: { hypothesis: plan.copy.hypothesis, treatmentTemplate: treatment, controlAllocation: 50 }
      }) });
      const campaign = await createResponse.json() as { id?: string; error?: string };
      if (!createResponse.ok || !campaign.id) throw new Error(campaign.error ?? "Campaign creation failed");
      const launchResponse = await fetch(`/api/campaigns/${campaign.id}/launch`, { method: "POST" });
      const result = await launchResponse.json() as { error?: string };
      if (!launchResponse.ok) throw new Error(result.error ?? "Campaign launch failed");
      return campaign.id;
    },
    onSuccess: (id) => { notify({ tone: "success", title: "Autopilot launched", message: "The approved plan is executing with guardrails enabled." }); router.push(`/campaigns/${id}`); },
    onError: (error) => notify({ tone: "error", title: "Launch blocked", message: error instanceof Error ? error.message : "Campaign launch failed" })
  });

  return <div className="space-y-5 pb-24">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div><p className="label mb-2">AI campaign autopilot</p><h1 className="text-3xl font-semibold">Plan, prove, approve</h1><p className="mt-1 text-sm text-[#64716c]">One instruction becomes a traceable campaign. Nothing sends without your confirmation.</p></div>
      <span className="inline-flex items-center gap-2 rounded-md border border-[#bcd9ce] bg-[#eef7f3] px-3 py-2 text-xs font-semibold text-accent"><ShieldCheck size={15} /> Human approval required</span>
    </header>

    <section className="panel p-5">
      <label className="label" htmlFor="campaign-intent">Campaign objective and constraints</label>
      <div className="mt-2 flex flex-col gap-2 md:flex-row"><textarea id="campaign-intent" className="input min-h-24 flex-1 resize-none text-base leading-6" value={intent} onChange={(event) => setIntent(event.target.value)} /><button className="btn btn-primary self-stretch md:w-44" disabled={generate.isPending || intent.trim().length < 12} onClick={() => generate.mutate()}>{generate.isPending ? <Loader2 className="animate-spin" size={17} /> : <Sparkles size={17} />}{generate.isPending ? "Building plan" : plan ? "Regenerate" : "Build plan"}</button></div>
    </section>

    {!plan ? <section className="grid gap-4 md:grid-cols-3">{[
      [Users, "Audience evidence", "Preview selected and excluded customers with policy reasons."],
      [Gauge, "Grounded preflight", "Estimate reach, delivery cost, revenue, ROI, and budget risk."],
      [ListChecks, "Decision trace", "Expose every rule, model input, recommendation, and approval event."]
    ].map(([Icon, title, detail]) => { const Component = Icon as typeof Users; return <article className="panel p-5" key={String(title)}><Component size={20} className="text-accent" /><h2 className="mt-4 font-semibold">{String(title)}</h2><p className="mt-1 text-sm text-[#71807a]">{String(detail)}</p></article>; })}</section> : <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[
        ["Eligible reach", plan.estimates.reach.toLocaleString(), `${plan.estimates.holdout} holdout`],
        ["Excluded", plan.estimates.excluded.toLocaleString(), "Consent and policy"],
        ["Estimated cost", `$${plan.estimates.cost.toFixed(2)}`, budgetOkay ? `$${budget.toFixed(0)} ceiling` : "Over edited budget"],
        ["Expected revenue", `$${plan.estimates.revenue.toFixed(0)}`, "Probability-weighted"],
        ["Projected ROI", `${plan.estimates.roi.toFixed(0)}%`, plan.estimates.withinBudget ? "Within budget" : "Budget warning"]
      ].map(([label, value, note]) => <article className="panel p-4" key={label}><span className="label">{label}</span><strong className="mt-2 block text-2xl">{value}</strong><p className={`mt-1 text-xs ${label === "Estimated cost" && !plan.estimates.withinBudget ? "text-red-700" : "text-[#71807a]"}`}>{note}</p></article>)}</section>

      <section className="panel overflow-hidden">
        <div className="flex overflow-x-auto border-b border-line bg-[#f8faf9] px-3">{tabs.map((item) => <button key={item} onClick={() => setTab(item)} className={`min-h-12 shrink-0 border-b-2 px-4 text-sm font-semibold ${tab === item ? "border-accent text-accent" : "border-transparent text-[#64716c]"}`}>{item}</button>)}</div>
        <div className="p-5 md:p-6">
          {tab === "Approval" && <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
            <div className="space-y-5">
              <div><div className="flex items-center justify-between"><div><span className="label">Audience</span><h2 className="mt-1 text-lg font-semibold">{plan.segment.name}</h2></div><span className="text-sm font-semibold text-accent">{plan.segment.eligible} eligible</span></div><p className="mt-2 text-sm text-[#64716c]">{plan.segment.description}</p></div>
              <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-md border border-line p-4"><span className="label">Recommended channel</span><strong className="mt-2 block text-lg">{plan.recommendation.channel}</strong><p className="mt-1 text-xs leading-5 text-[#71807a]">{plan.recommendation.reasoning}</p></div><div className="rounded-md border border-line p-4"><span className="label">Recommended send time</span><strong className="mt-2 block text-lg">{String(plan.recommendation.sendHour).padStart(2, "0")}:00 local</strong><p className="mt-1 text-xs text-[#71807a]">Applied per customer at dispatch.</p></div></div>
              <div><label className="label" htmlFor="control-copy">Control message</label><textarea id="control-copy" className="input mt-2 min-h-24 resize-none" value={control} onChange={(event) => setControl(event.target.value)} /></div>
              <div><label className="label" htmlFor="treatment-copy">AI treatment</label><textarea id="treatment-copy" className="input mt-2 min-h-24 resize-none" value={treatment} onChange={(event) => setTreatment(event.target.value)} /><p className="mt-1 text-xs text-[#71807a]">Randomized 50/50 against control; holdout customers receive neither.</p></div>
            </div>
            <div className="space-y-4">
              <div className="rounded-md border border-line bg-[#f8faf9] p-4"><div className="flex items-center gap-2"><PauseCircle size={17} className="text-accent" /><h3 className="font-semibold">Adaptive guardrails</h3></div><div className="mt-4 grid grid-cols-2 gap-3"><label className="text-xs font-semibold text-[#5e6d67]">Budget ceiling<input aria-label="Budget ceiling" className="input mt-1" type="number" min="1" value={budget} onChange={(event) => setBudget(Number(event.target.value))} /></label><label className="text-xs font-semibold text-[#5e6d67]">Holdout %<input aria-label="Holdout percentage" className="input mt-1" type="number" min="0" max="25" value={holdout} onChange={(event) => setHoldout(Number(event.target.value))} /></label><label className="text-xs font-semibold text-[#5e6d67]">Max failure %<input aria-label="Maximum failure rate" className="input mt-1" type="number" min="1" max="100" value={failureThreshold} onChange={(event) => setFailureThreshold(Number(event.target.value))} /></label><label className="text-xs font-semibold text-[#5e6d67]">Min conversion %<input aria-label="Minimum conversion rate" className="input mt-1" type="number" min="0" max="100" value={conversionFloor} onChange={(event) => setConversionFloor(Number(event.target.value))} /></label></div></div>
              <div className="rounded-md border border-line p-4"><label className="flex items-center justify-between gap-3 text-sm font-semibold"><span className="flex items-center gap-2"><FlaskConical size={17} /> Channel-service chaos mode</span><input aria-label="Enable chaos mode" type="checkbox" checked={chaosEnabled} onChange={(event) => setChaosEnabled(event.target.checked)} /></label>{chaosEnabled && <div className="mt-4 space-y-3"><label className="block text-xs font-semibold text-[#5e6d67]">Injected failure rate: {chaosFailure}%<input className="mt-2 w-full accent-[#147d64]" type="range" min="0" max="50" value={chaosFailure} onChange={(event) => setChaosFailure(Number(event.target.value))} /></label><label className="block text-xs font-semibold text-[#5e6d67]">Callback latency<input className="input mt-1" type="number" min="0" max="30000" value={chaosLatency} onChange={(event) => setChaosLatency(Number(event.target.value))} /></label><label className="flex items-center justify-between text-sm">Duplicate callbacks<input aria-label="Duplicate callbacks" type="checkbox" checked={duplicateCallbacks} onChange={(event) => setDuplicateCallbacks(event.target.checked)} /></label><label className="flex items-center justify-between text-sm">Out-of-order callbacks<input aria-label="Out-of-order callbacks" type="checkbox" checked={outOfOrder} onChange={(event) => setOutOfOrder(event.target.checked)} /></label></div>}</div>
              {!budgetOkay && <p className="flex gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="shrink-0" size={17} />Projected cost exceeds the current budget. Raise the ceiling or narrow the audience.</p>}
            </div>
          </div>}
          {tab === "Audience" && <div><h2 className="font-semibold">Why these customers</h2><p className="mt-1 text-sm text-[#71807a]">Ranked by conversion propensity and expected revenue after policy enforcement.</p><div className="mt-4 divide-y divide-line rounded-md border border-line">{plan.included.map((customer) => <div key={customer.id} className="grid gap-3 p-4 md:grid-cols-[1fr_100px_90px_1.5fr]"><div><strong className="text-sm">{customer.name}</strong><p className="text-xs text-[#71807a]">{customer.city}</p></div><span className="text-sm">${customer.value.toFixed(0)} LTV</span><strong className="text-sm text-accent">{customer.score.toFixed(1)} score</strong><p className="text-xs leading-5 text-[#64716c]">{customer.reasons.join(" · ")}</p></div>)}</div></div>}
          {tab === "Exclusions" && <div><h2 className="font-semibold">Excluded customers and reasons</h2><p className="mt-1 text-sm text-[#71807a]">These customers will not receive a message even after approval.</p><div className="mt-4 divide-y divide-line rounded-md border border-line">{plan.excluded.length ? plan.excluded.map((customer) => <div key={customer.id} className="flex items-center justify-between gap-4 p-4 text-sm"><strong>{customer.name}</strong><span className="rounded bg-[#f9e4df] px-2 py-1 text-xs font-semibold text-[#a53c2b]">{customer.reason}</span></div>) : <p className="p-4 text-sm text-[#71807a]">No policy exclusions in this audience.</p>}</div></div>}
          {tab === "Decision trace" && <div><div className="flex items-center gap-2"><Bot size={18} className="text-accent" /><h2 className="font-semibold">AI execution trace</h2></div><div className="mt-5 space-y-0">{plan.trace.map((entry, index) => <div key={entry.step} className="grid grid-cols-[28px_1fr] gap-3"><div className="flex flex-col items-center"><span className="grid size-7 place-items-center rounded-full border border-accent bg-[#eef7f3] text-xs font-bold text-accent">{index + 1}</span>{index < plan.trace.length - 1 && <span className="h-full w-px bg-line" />}</div><div className="pb-5"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{entry.step}</strong><span className="rounded bg-[#edf2ef] px-2 py-0.5 text-[11px] font-semibold text-[#64716c]">{entry.source}</span></div><p className="mt-1 text-sm text-[#64716c]">{entry.detail}</p></div></div>)}</div></div>}
        </div>
      </section>
      <footer className="fixed bottom-0 left-0 right-0 z-30 border-t border-line bg-white/95 px-4 py-3 shadow-[0_-8px_24px_rgb(16_42_36_/_8%)] backdrop-blur md:left-60"><div className="mx-auto flex max-w-[1436px] flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-3 text-sm font-semibold"><input aria-label="Approve campaign plan" type="checkbox" checked={approved} onChange={(event) => setApproved(event.target.checked)} /><span>I reviewed the audience, estimates, copy, holdout, and guardrails.</span></label><button className="btn btn-primary min-w-44" disabled={!approved || launch.isPending || !budgetOkay} onClick={() => launch.mutate()}>{launch.isPending ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}{launch.isPending ? "Launching" : "Approve and launch"}<ChevronRight size={15} /></button></div></footer>
    </>}
  </div>;
}
