import { z } from "zod";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env"), override: true });

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().min(1),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OPENROUTER_MODEL: z.string().min(1).default("nvidia/nemotron-3-nano-30b-a3b:free"),
  OPENROUTER_SITE_URL: z.string().url().optional(),
  OPENROUTER_APP_NAME: z.string().min(1).default("Xeno Mini CRM"),
  CHANNEL_SERVICE_URL: z.string().url(),
  RECEIPT_HMAC_SECRET: z.string().min(32),
  COMMERCE_HMAC_SECRET: z.string().min(32),
  ALERT_WEBHOOK_URL: z.string().url().optional(),
  NEXTAUTH_SECRET: z.string().min(32),
  MARKETER_EMAIL: z.string().email(),
  MARKETER_PASSWORD_SHA256: z.string().regex(/^[a-f0-9]{64}$/),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development")
});

export const env = serverEnvSchema.parse({
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
  OPENROUTER_MODEL: process.env.OPENROUTER_MODEL,
  OPENROUTER_SITE_URL: process.env.OPENROUTER_SITE_URL,
  OPENROUTER_APP_NAME: process.env.OPENROUTER_APP_NAME,
  CHANNEL_SERVICE_URL: process.env.CHANNEL_SERVICE_URL,
  RECEIPT_HMAC_SECRET: process.env.RECEIPT_HMAC_SECRET,
  COMMERCE_HMAC_SECRET: process.env.COMMERCE_HMAC_SECRET ?? process.env.RECEIPT_HMAC_SECRET,
  ALERT_WEBHOOK_URL: process.env.ALERT_WEBHOOK_URL,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  MARKETER_EMAIL: process.env.MARKETER_EMAIL,
  MARKETER_PASSWORD_SHA256: process.env.MARKETER_PASSWORD_SHA256,
  NODE_ENV: process.env.NODE_ENV
});
