import { NextResponse } from "next/server";
import { normalizeEvents } from "@/lib/first/normalize";
import { FirstApiError, getFirstJson } from "@/lib/first/server";

export const runtime = "nodejs";
type Context = { params: Promise<{ eventCode: string }> };

export async function GET(request: Request, { params }: Context) {
  const { eventCode } = await params;
  const season = Number(new URL(request.url).searchParams.get("season") ?? "2026");
  if (!/^[a-z\d]{3,30}$/i.test(eventCode) || !Number.isInteger(season) || season < 2023 || season > 9999) {
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
