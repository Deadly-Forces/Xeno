import { generateText } from "ai";
import { segmentDslSchema } from "@xeno/shared-types";
import { z } from "zod";
import { crmLanguageModel, isAiConfigured } from "../../../../lib/ai/model";
import { segmentGenerationPrompt } from "../../../../lib/ai/prompts";
import { extractJsonObject, normalizeSegmentDslCandidate } from "../../../../lib/ai/segment-normalizer";
import { apiError } from "../../../../lib/core/http";
import { rateLimit } from "../../../../lib/security/rate-limit";
import { isResponse, requireRole } from "../../../../lib/auth/rbac";

const requestSchema = z.object({ description: z.string().trim().min(3).max(2_000) });
const responseSchema = z.object({ rules: segmentDslSchema, explanation: z.string().min(1).max(1_000) });

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireRole("MARKETER");
    const limit = await rateLimit(`segment-ai:${actor.organizationId}:${actor.id}`, 10, 60);
    if (!limit.allowed) return Response.json({ error: "AI request limit exceeded" }, { status: 429, headers: { "retry-after": "60" } });
    if (!isAiConfigured()) return Response.json({ error: "OpenRouter is not configured" }, { status: 503 });
    const input = requestSchema.parse(await request.json());
    const result = await generateText({
      model: crmLanguageModel(),
      system: `${segmentGenerationPrompt}\nReturn only one JSON object with keys rules and explanation. Do not use Markdown.`,
      prompt: `Current date: ${new Date().toISOString()}\nRequest: ${input.description}`,
      abortSignal: AbortSignal.timeout(30_000)
    });
    const decoded = extractJsonObject(result.text);
    const object = typeof decoded === "object" && decoded !== null ? decoded as Record<string, unknown> : {};
    return Response.json(responseSchema.parse({ rules: normalizeSegmentDslCandidate(object.rules), explanation: object.explanation }));
  } catch (error) {
    return isResponse(error) ? error : apiError(error);
  }
}
