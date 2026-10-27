import { NextResponse } from "next/server";
import { normalizeHybridSchedule } from "@/lib/first/normalize";
import { FirstApiError, getFirstJson } from "@/lib/first/server";

export const runtime = "nodejs";
type Context = { params: Promise<{ eventCode: string }> };
export async function GET(request: Request, { params }: Context) {
  const { eventCode } = await params;
  if (!/^[a-z\d]{3,30}$/i.test(eventCode)) return NextResponse.json({ error: "El código del evento no es válido." }, { status: 400 });
  const url = new URL(request.url);
  const season = Number(url.searchParams.get("season") ?? "2026");
  const level = url.searchParams.get("level") ?? "qual";
  if (!Number.isInteger(season) || season < 2023 || season > 9999) return NextResponse.json({ error: "Indica un año de temporada válido." }, { status: 400 });
  if (level !== "qual" && level !== "playoff") return NextResponse.json({ error: "El nivel debe ser qual o playoff." }, { status: 400 });
  try {
    const key = `schedule:${season}:${eventCode.toUpperCase()}:${level}`;
    const value = await getFirstJson({ key, season, eventCode, level, url: `https://ftc-api.firstinspires.org/v2.0/${season}/schedule/${encodeURIComponent(eventCode)}/${level}/hybrid`, refresh: url.searchParams.get("refresh") === "1" });
    return NextResponse.json({ season, eventCode: eventCode.toUpperCase(), level, matches: normalizeHybridSchedule(value.payload, season, eventCode, level), syncedAt: value.syncedAt, lastModified: value.lastModified, persisted: value.stored, stale: value.stale ?? false, warning: value.warning ?? null }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof FirstApiError) return NextResponse.json({ error: error.message, retryAfter: error.retryAfter, upstreamStatus: error.upstreamStatus, upstreamIssue: error.upstreamIssue }, { status: error.status });
    return NextResponse.json({ error: "No fue posible consultar el calendario oficial." }, { status: 502 });
  }
}
