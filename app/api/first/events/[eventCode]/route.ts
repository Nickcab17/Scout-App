import { NextResponse } from "next/server";
import { normalizeEvents } from "@/lib/first/normalize";
import { FirstApiError, getFirstJson } from "@/lib/first/server";
import { FIRST_SEASON, isSupportedFirstSeason } from "@/lib/first/season";

export const runtime = "nodejs";
type Context = { params: Promise<{ eventCode: string }> };

export async function GET(request: Request, { params }: Context) {
  const { eventCode } = await params;
  const season = Number(new URL(request.url).searchParams.get("season") ?? FIRST_SEASON);
  if (!/^[a-z\d]{3,30}$/i.test(eventCode) || !isSupportedFirstSeason(season)) {
    return NextResponse.json({ error: "El evento o la temporada no son válidos." }, { status: 400 });
  }
  try {
    const value = await getFirstJson({ key: `event:${season}:${eventCode.toUpperCase()}`, season, eventCode, url: `https://ftc-api.firstinspires.org/v2.0/${season}/events?eventCode=${encodeURIComponent(eventCode)}`, refresh: new URL(request.url).searchParams.get("refresh") === "1" });
    return NextResponse.json({ season, event: normalizeEvents(value.payload)[0] ?? null, syncedAt: value.syncedAt, stale: value.stale ?? false, warning: value.warning ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof FirstApiError) return NextResponse.json({ error: error.message, retryAfter: error.retryAfter }, { status: error.status });
    return NextResponse.json({ error: "No fue posible consultar el evento oficial." }, { status: 502 });
  }
}
