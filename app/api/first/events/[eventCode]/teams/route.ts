import { NextResponse } from "next/server";
import { FirstApiError, getFirstJson } from "@/lib/first/server";

export const runtime = "nodejs";
type Context = { params: Promise<{ eventCode: string }> };

export async function GET(request: Request, { params }: Context) {
  const { eventCode } = await params;
  const season = Number(new URL(request.url).searchParams.get("season") ?? "2026");
  if (!/^[a-z\d]{3,30}$/i.test(eventCode) || !Number.isInteger(season) || season < 2023 || season > 9999) return NextResponse.json({ error: "El evento o la temporada no son válidos." }, { status: 400 });
  try {
    const value = await getFirstJson({ key: `teams:${season}:${eventCode.toUpperCase()}`, season, eventCode, url: `https://ftc-api.firstinspires.org/v2.0/${season}/teams?eventCode=${encodeURIComponent(eventCode)}`, refresh: new URL(request.url).searchParams.get("refresh") === "1" });
    const payload = value.payload && typeof value.payload === "object" ? value.payload as Record<string, unknown> : {};
    return NextResponse.json({ season, eventCode: eventCode.toUpperCase(), teams: Array.isArray(payload.teams) ? payload.teams : [], teamCountTotal: payload.teamCountTotal ?? null, syncedAt: value.syncedAt, stale: value.stale ?? false, warning: value.warning ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof FirstApiError) return NextResponse.json({ error: error.message, retryAfter: error.retryAfter }, { status: error.status });
    return NextResponse.json({ error: "No fue posible consultar los equipos oficiales del evento." }, { status: 502 });
  }
}
