const stateChangingMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function rejectCrossSiteRequest(request: Request): Response | null {
  if (!stateChangingMethods.has(request.method.toUpperCase())) return null;
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "cross-site") return Response.json({ error: "Cross-site request rejected" }, { status: 403 });
  const origin = request.headers.get("origin");
  if (!origin) return null;
  const expected = new URL(request.url).origin;
  if (origin !== expected) return Response.json({ error: "Invalid request origin" }, { status: 403 });
  return null;
}

export function rejectOversizedRequest(request: Request, maximumBytes: number): Response | null {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > maximumBytes) return Response.json({ error: "Request body too large" }, { status: 413 });
  return null;
}
