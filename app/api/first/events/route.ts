import { NextResponse } from "next/server";
import { normalizeEvents } from "@/lib/first/normalize";
import { FirstApiError, getFirstJson } from "@/lib/first/server";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const season = Number(new URL(request.url).searchParams.get("season") ?? "2026");
  if (!Number.isInteger(season) || season < 2023 || season > 9999) return NextResponse.json({ error: "Indica un año de temporada válido." }, { status: 400 });
  try {
    const value = await getFirstJson({ key: `events:${season}`, season, url: `https://ftc-api.firstinspires.org/v2.0/${season}/events`, refresh: new URL(request.url).searchParams.get("refresh") === "1" });
    return NextResponse.json({ season, events: normalizeEvents(value.payload), syncedAt: value.syncedAt, lastModified: value.lastModified, persisted: value.stored, stale: value.stale ?? false, warning: value.warning ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof FirstApiError) return NextResponse.json({ error: error.message, retryAfter: error.retryAfter, upstreamStatus: error.upstreamStatus, upstreamIssue: error.upstreamIssue }, { status: error.status });
    return NextResponse.json({ error: "No fue posible consultar FTC Events." }, { status: 502 });
  }
}
