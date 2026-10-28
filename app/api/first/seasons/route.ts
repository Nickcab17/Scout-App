import { NextResponse } from "next/server";
import { FirstApiError, getFirstJson } from "@/lib/first/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const value = await getFirstJson({ key: "seasons:index", season: 2026, url: "https://ftc-api.firstinspires.org/v2.0", refresh: new URL(request.url).searchParams.get("refresh") === "1" });
    const payload = value.payload && typeof value.payload === "object" ? value.payload as Record<string, unknown> : {};
    return NextResponse.json({ currentSeason: payload.currentSeason ?? null, maxSeason: payload.maxSeason ?? null, syncedAt: value.syncedAt, stale: value.stale ?? false, warning: value.warning ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof FirstApiError) return NextResponse.json({ error: error.message, retryAfter: error.retryAfter }, { status: error.status });
    return NextResponse.json({ error: "No fue posible consultar las temporadas oficiales." }, { status: 502 });
  }
}
