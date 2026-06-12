import { WebSocketServer } from "ws";
import IORedis from "ioredis";
import { env } from "./lib/env";
import { verifyRealtimeToken } from "./lib/realtime-token";

const port = Number(process.env.WS_PORT ?? 3001);
const clients = new Map<string, Set<import("ws").WebSocket>>();
async function start(): Promise<void> {
  const server = new WebSocketServer({ port });
  const subscriber = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  await subscriber.psubscribe("campaign:*:events");
  subscriber.on("pmessage", (_pattern, channel, message) => { const campaignId = channel.split(":")[1]; if (!campaignId) return; for (const socket of clients.get(campaignId) ?? []) if (socket.readyState === socket.OPEN) socket.send(message); });
  server.on("connection", (socket, request) => { const token = new URL(request.url ?? "/", `http://${request.headers.host}`).searchParams.get("token"); const claims = token ? verifyRealtimeToken(token) : null; if (!claims) { socket.close(1008, "Invalid token"); return; } const set = clients.get(claims.campaignId) ?? new Set(); set.add(socket); clients.set(claims.campaignId, set); socket.send(JSON.stringify({ type: "connected", campaignId: claims.campaignId })); socket.on("close", () => { set.delete(socket); if (!set.size) clients.delete(claims.campaignId); }); });
  console.log(JSON.stringify({ level: "info", event: "websocket_ready", port }));
}
void start();
