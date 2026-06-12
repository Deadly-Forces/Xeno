import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { SegmentDslError } from "./segments/execute";

export function apiError(error: unknown): NextResponse {
  if (error instanceof ZodError) return NextResponse.json({ error: "Validation failed", details: error.flatten() }, { status: 400 });
  if (error instanceof SegmentDslError) return NextResponse.json({ error: error.message }, { status: 400 });
  console.error(JSON.stringify({ level: "error", error: error instanceof Error ? error.message : "Unknown error" }));
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
