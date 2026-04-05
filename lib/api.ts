// ─── Shared API Response Helpers ─────────────────────────────────────────────
// Used by all API route handlers.

import { NextResponse } from "next/server";

export function jsonError(message: string, status: number = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export function jsonSuccess(data: Record<string, unknown> = {}) {
  return NextResponse.json({ success: true, ...data });
}
