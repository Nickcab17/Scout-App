import { NextResponse } from "next/server";
import { FirstApiError, getFirstJson } from "@/lib/first/server";
import { FIRST_SEASON } from "@/lib/first/season";

export const runtime = "nodejs";
type Context = { params: Promise<{ eventCode: string; level: string }> };

export async function GET(request: Request, { params }: Context) {
  const { eventCode, level } = await params;
  const season = Number(new URL(request.url).searchParams.get("season") ?? FIRST_SEASON);
  if (!/^[a-z\d]{3,30}$/i.test(eventCode) || !["qual", "playoff"].includes(level) || season !== FIRST_SEASON) return NextResponse.json({ error: "El evento, nivel o temporada no son válidos." }, { status: 400 });
  try {
    const value = await getFirstJson({ key: `scores:${season}:${eventCode.toUpperCase()}:${level}`, season, eventCode, level, url: `https://ftc-api.firstinspires.org/v2.0/${season}/scores/${encodeURIComponent(eventCode)}/${level}`, refresh: new URL(request.url).searchParams.get("refresh") === "1" });
    const payload = value.payload && typeof value.payload === "object" ? value.payload as Record<string, unknown> : {};
    return NextResponse.json({ season, eventCode: eventCode.toUpperCase(), level, scoreDetails: Array.isArray(payload.matchScores) ? payload.matchScores : Array.isArray(payload.scores) ? payload.scores : [], syncedAt: value.syncedAt, stale: value.stale ?? false, warning: value.warning ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof FirstApiError) return NextResponse.json({ error: error.message, retryAfter: error.retryAfter }, { status: error.status });
    return NextResponse.json({ error: "No fue posible consultar el detalle oficial de scoring." }, { status: 502 });
  }
}
