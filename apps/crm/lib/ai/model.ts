import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { env } from "../env";

const openrouter = createOpenRouter({
  apiKey: env.OPENROUTER_API_KEY ?? "",
  headers: {
    ...(env.OPENROUTER_SITE_URL ? { "HTTP-Referer": env.OPENROUTER_SITE_URL } : {}),
    "X-OpenRouter-Title": env.OPENROUTER_APP_NAME
  }
});

export function isAiConfigured(): boolean {
  return Boolean(env.OPENROUTER_API_KEY);
}

export function crmLanguageModel() {
  return openrouter(env.OPENROUTER_MODEL);
}
