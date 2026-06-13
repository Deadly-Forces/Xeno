import { z } from "zod";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), "../../.env"), override: true });

export const env = z.object({
  PORT: z.coerce.number().int().positive().default(4000),
  REDIS_URL: z.string().min(1),
  CRM_RECEIPT_URL: z.string().url(),
  RECEIPT_HMAC_SECRET: z.string().min(32),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info")
}).parse(process.env);
