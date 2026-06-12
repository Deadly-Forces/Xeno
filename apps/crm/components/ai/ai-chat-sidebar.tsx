"use client";

import { useChat } from "ai/react";
import { Bot, CheckCircle2, Eye, MessageSquareText, Send, Sparkles } from "lucide-react";
import { useEffect, useRef } from "react";

type ToolResult = Record<string, unknown>;

type ToolInvocation = {
  toolCallId: string;
  toolName: string;
  state: string;
  result?: unknown;
};

function isToolResult(value: unknown): value is ToolResult {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanAssistantText(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .trim();
}

function ToolResultCard({ invocation }: { invocation: ToolInvocation }): JSX.Element {
  if (invocation.state !== "result") {
    return <div className="mt-3 flex items-center gap-2 rounded-md border border-[#bcd9ce] bg-[#eef7f3] p-3 text-xs font-medium text-[#285749]"><Sparkles className="animate-pulse" size={14} />Working on it...</div>;
  }

  if (!isToolResult(invocation.result)) {
    return <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">The AI action returned an unreadable result.</div>;
  }

  const result = invocation.result;

  if (typeof result.error === "string") {
    return <div className="mt-3 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">{result.error}</div>;
  }

  if (invocation.toolName === "create_segment") {
    return <div className="mt-3 rounded-md border border-[#bcd9ce] bg-[#eef7f3] p-3 text-[#285749]">
      <div className="flex items-center gap-2 text-xs font-bold uppercase"><CheckCircle2 size={15} /> Segment created</div>
      <strong className="mt-2 block break-words text-sm text-ink">{String(result.name ?? "New segment")}</strong>
      <p className="mt-1 text-xs">{Number(result.customerCount ?? 0).toLocaleString()} customers</p>
    </div>;
  }

  if (invocation.toolName === "draft_message") {
    return <div data-testid="message-draft-card" className="mt-3 rounded-md border border-[#bcd9ce] bg-[#eef7f3] p-3 text-[#285749]">
      <div className="flex items-center gap-2 text-xs font-bold uppercase"><MessageSquareText size={15} /> Message draft</div>
      <div className="mt-2 flex gap-2 text-[11px] font-semibold uppercase"><span>{String(result.channel ?? "")}</span><span>·</span><span>{String(result.tone ?? "")}</span></div>
      <p className="mt-2 whitespace-pre-wrap break-words rounded border border-[#cfe2da] bg-white p-3 text-sm leading-5 text-ink">{String(result.template ?? "Draft ready")}</p>
    </div>;
  }

  if (invocation.toolName === "preview_segment") {
    return <div className="mt-3 rounded-md border border-[#bcd9ce] bg-[#eef7f3] p-3 text-[#285749]">
      <div className="flex items-center gap-2 text-xs font-bold uppercase"><Eye size={15} /> Segment preview</div>
      <strong className="mt-2 block text-xl text-ink">{Number(result.count ?? 0).toLocaleString()}</strong>
      <p className="text-xs">matching customers</p>
    </div>;
  }

  if (invocation.toolName === "recommend_campaign") {
    return <div className="mt-3 rounded-md border border-[#bcd9ce] bg-[#eef7f3] p-3 text-[#285749]"><div className="text-xs font-bold uppercase">Recommended channel</div><strong className="mt-2 block text-base text-ink">{String(result.channel ?? "EMAIL")}</strong><p className="mt-1 text-xs leading-5">{String(result.reasoning ?? "")}</p></div>;
  }

  if (invocation.toolName === "launch_campaign") {
    return <div className="mt-3 rounded-md border border-[#bcd9ce] bg-[#eef7f3] p-3 text-xs font-medium text-[#285749]"><div className="flex items-center gap-2"><CheckCircle2 size={14} />Campaign launched to {Number(result.enqueued ?? 0).toLocaleString()} customers</div>{typeof result.campaignId === "string" ? <a className="mt-2 inline-block font-semibold underline" href={`/campaigns/${result.campaignId}`}>View campaign</a> : null}</div>;
  }

  return <div className="mt-3 flex items-center gap-2 rounded-md border border-[#bcd9ce] bg-[#eef7f3] p-3 text-xs font-medium text-[#285749]"><CheckCircle2 size={14} />Action completed</div>;
}

export function AIChatSidebar({ onDraft, onRecommendation, onSegmentCreated }: { onDraft?: (draft: { template: string; channel: string }) => void; onRecommendation?: (channel: string) => void; onSegmentCreated?: () => void } = {}): JSX.Element {
  const { messages, input, handleInputChange, handleSubmit, isLoading, error } = useChat({ api: "/api/ai/chat" });
  const handled = useRef(new Set<string>());

  useEffect(() => {
    for (const message of messages) for (const invocation of message.toolInvocations ?? []) {
      if (invocation.state !== "result" || handled.current.has(invocation.toolCallId) || !isToolResult(invocation.result)) continue;
      handled.current.add(invocation.toolCallId);
      if (invocation.toolName === "draft_message") onDraft?.({ template: String(invocation.result.template ?? ""), channel: String(invocation.result.channel ?? "EMAIL") });
      if (invocation.toolName === "recommend_campaign") onRecommendation?.(String(invocation.result.channel ?? "EMAIL"));
      if (invocation.toolName === "create_segment") onSegmentCreated?.();
    }
  }, [messages, onDraft, onRecommendation, onSegmentCreated]);

  return <aside className="flex h-[calc(100vh-10rem)] min-h-[560px] min-w-0 flex-col overflow-hidden border-l border-line bg-white">
    <div className="border-b border-line px-5 py-4"><div className="flex items-center gap-2 font-semibold"><Sparkles size={17} className="text-coral" /> Campaign copilot</div><p className="mt-1 text-xs text-[#75817d]">Build segments, draft copy, inspect reach.</p></div>
    <div className="min-w-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-4">
      {messages.length === 0 && <div className="rounded-md border border-[#d8e5df] bg-[#f3f8f5] p-4 text-sm text-[#42554e]"><Bot size={18} className="mb-2 text-accent" />Describe the audience or campaign outcome you need.</div>}
      {messages.map((message) => <div key={message.id} className={`min-w-0 max-w-[92%] overflow-hidden rounded-md p-3 text-sm ${message.role === "user" ? "ml-auto bg-[#183b33] text-white" : "border border-line bg-white"}`}>
        {message.content && <p className="whitespace-pre-wrap break-words leading-6">{message.role === "assistant" ? cleanAssistantText(message.content) : message.content}</p>}
        {message.toolInvocations?.map((invocation) => <ToolResultCard key={invocation.toolCallId} invocation={invocation as ToolInvocation} />)}
      </div>)}
      {isLoading && <p className="text-xs text-[#75817d]">Thinking...</p>}
      {error && <p className="rounded bg-red-50 p-2 text-xs text-red-700">The campaign assistant could not complete that request. Please try again.</p>}
    </div>
    <form onSubmit={handleSubmit} className="border-t border-line p-3"><div className="flex min-w-0 gap-2"><input className="input min-w-0" value={input} onChange={handleInputChange} placeholder="Ask for a segment or message..." /><button className="btn btn-primary size-10 shrink-0 p-0" aria-label="Send"><Send size={16} /></button></div></form>
  </aside>;
}
