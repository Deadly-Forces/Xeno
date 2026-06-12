const startedAt = Date.now();
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json({ status: "ok", uptime: Math.floor((Date.now() - startedAt) / 1_000) });
}
