import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { env } from "./lib/env.js";
import { sendRoute } from "./routes/send.js";
import { startWorkers } from "./workers/simulator.js";

const app = new Hono();
const startedAt = Date.now();
app.get("/health", (context) => context.json({ status: "ok", uptime: Math.floor((Date.now() - startedAt) / 1_000) }));
app.route("/send", sendRoute);
startWorkers();
serve({ fetch: app.fetch, port: env.PORT });
