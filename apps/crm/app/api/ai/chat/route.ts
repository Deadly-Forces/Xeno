import { convertToCoreMessages, streamText, type Message } from "ai";
import { crmAssistantPrompt } from "../../../../lib/ai/prompts";
import { createCrmTools } from "../../../../lib/ai/tools";
import { crmLanguageModel, isAiConfigured } from "../../../../lib/ai/model";
import { rateLimit } from "../../../../lib/rate-limit";
import { isResponse, requireRole } from "../../../../lib/rbac";
import { rejectCrossSiteRequest, rejectOversizedRequest } from "../../../../lib/request-security";
import { z } from "zod";

export const maxDuration = 60;

const chatSchema = z.object({ messages: z.array(z.object({ id: z.string().optional(), role: z.enum(["user", "assistant", "system", "data"]), content: z.string().max(20_000) }).passthrough()).min(1).max(50) });

export async function POST(request: Request): Promise<Response> {
  const rejected = rejectCrossSiteRequest(request) ?? rejectOversizedRequest(request, 250_000);
  if (rejected) return rejected;
  let actor;
  try { actor = await requireRole("MARKETER"); } catch (error) { return isResponse(error) ? error : Response.json({ error: "Forbidden" }, { status: 403 }); }
  const limit = await rateLimit(`ai-chat:${actor.organizationId}:${actor.id}`, 20, 60);
  if (!limit.allowed) return Response.json({ error: "AI request limit exceeded" }, { status: 429, headers: { "retry-after": "60" } });
  if (!isAiConfigured()) return Response.json({ error: "OpenRouter is not configured" }, { status: 503 });
  const parsed = chatSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid chat request" }, { status: 400 });
  const body = parsed.data as unknown as { messages: Message[] };
  const latestUserRequest = [...body.messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const result = streamText({
    model: crmLanguageModel(),
    system: crmAssistantPrompt,
    messages: convertToCoreMessages(body.messages),
    tools: createCrmTools(latestUserRequest, actor.organizationId),
    maxSteps: 1,
    abortSignal: AbortSignal.timeout(60_000)
  });
  return result.toDataStreamResponse();
}
