"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SegmentDSL } from "@xeno/shared-types";
import { Save, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { AIChatSidebar } from "../../components/ai/ai-chat-sidebar";
import { RuleBuilder } from "../../components/segments/rule-builder";

type Segment = { id: string; name: string; description: string; customerCount: number; createdBy: string };
const initialRules: SegmentDSL = { operator: "AND", rules: [{ field: "totalOrderValue", operator: "gt", value: 500 }] };

export default function SegmentsPage(): JSX.Element {
  const queryClient = useQueryClient();
  const [rules, setRules] = useState<SegmentDSL>(initialRules);
  const [name, setName] = useState("High-value audience");
  const [preview, setPreview] = useState<number | null>(null);
  const { data = [] } = useQuery<Segment[]>({ queryKey: ["segments"], queryFn: async () => (await fetch("/api/segments")).json() as Promise<Segment[]> });
  useEffect(() => { const timer = window.setTimeout(async () => { const response = await fetch("/api/segments/preview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(rules) }); if (response.ok) setPreview(((await response.json()) as { count: number }).count); }, 450); return () => window.clearTimeout(timer); }, [rules]);
  const create = useMutation({ mutationFn: async () => { const response = await fetch("/api/segments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, description: "Built in the visual rule editor", rules, createdBy: "human" }) }); if (!response.ok) throw new Error("Unable to create segment"); return response.json(); }, onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["segments"] }) });
  return <div className="space-y-6"><header><p className="label mb-2">Audience intelligence</p><h1 className="text-3xl font-semibold">Segments</h1><p className="mt-1 text-sm text-[#64716c]">Define precise groups manually or with the campaign copilot.</p></header>
    <div className="grid overflow-hidden rounded-lg border border-line bg-white lg:grid-cols-[minmax(0,1fr)_390px]"><div className="p-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">New segment</h2><p className="text-xs text-[#7b8783]">Visual rules and AI produce the same validated DSL.</p></div><div className="rounded-md bg-[#eaf4f0] px-3 py-2 text-sm font-bold text-accent">{preview ?? "..."} matches</div></div><label className="label">Segment name</label><input aria-label="Segment name" className="input mb-5 mt-1" value={name} onChange={(event) => setName(event.target.value)} /><RuleBuilder value={rules} onChange={setRules} /><button className="btn btn-primary mt-5" onClick={() => create.mutate()} disabled={create.isPending}><Save size={16} /> Save segment</button></div><AIChatSidebar onSegmentCreated={() => void queryClient.invalidateQueries({ queryKey: ["segments"] })} /></div>
    <section className="grid grid-cols-3 gap-4">{data.map((segment) => <article className="panel p-5" key={segment.id}><div className="mb-5 flex justify-between"><UsersRound className="text-accent" size={19} /><span className="text-xs font-bold uppercase text-[#7b8783]">{segment.createdBy}</span></div><h3 className="font-semibold">{segment.name}</h3><p className="mt-1 min-h-10 text-sm text-[#6c7974]">{segment.description}</p><strong className="mt-4 block text-2xl">{segment.customerCount}</strong><span className="text-xs text-[#7b8783]">customers</span></article>)}</section>
  </div>;
}
