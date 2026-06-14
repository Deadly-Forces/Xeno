import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { crmAssistantPrompt } from "../../../../lib/ai/prompts";
import { createCrmTools } from "../../../../lib/ai/tools";
import { crmLanguageModel, isAiConfigured } from "../../../../lib/ai/model";
import { rateLimit } from "../../../../lib/security/rate-limit";
import { isResponse, requireRole } from "../../../../lib/auth/rbac";
import { rejectCrossSiteRequest, rejectOversizedRequest } from "../../../../lib/security/request-security";
import { z } from "zod";

export const maxDuration = 60;

const chatSchema = z.object({ messages: z.array(z.object({ id: z.string().optional(), role: z.enum(["user", "assistant", "system"]), parts: z.array(z.object({ type: z.string() }).passthrough()).optional() }).passthrough()).min(1).max(50) });

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
  const latestUser = [...parsed.data.messages].reverse().find((m) => m.role === "user");
  const latestUserRequest = latestUser?.parts?.find((p): p is { type: string; text: string } => p.type === "text")?.text ?? "";
  const result = streamText({
    model: crmLanguageModel(),
    system: crmAssistantPrompt,
    messages: await convertToModelMessages(parsed.data.messages as unknown as UIMessage[]),
    tools: createCrmTools(latestUserRequest, actor.organizationId),
    abortSignal: AbortSignal.timeout(60_000)
  });
  return result.toUIMessageStreamResponse();
}
