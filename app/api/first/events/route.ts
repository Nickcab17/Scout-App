import { NextResponse } from "next/server";
import { normalizeEvents } from "@/lib/first/normalize";
import { FirstApiError, getFirstJson } from "@/lib/first/server";
import { getAllFirstEventPages } from "@/lib/first/event-pagination";
import { FIRST_SEASON } from "@/lib/first/season";

export const runtime = "nodejs";
export async function GET(request: Request) {
  const season = Number(new URL(request.url).searchParams.get("season") ?? FIRST_SEASON);
  if (season !== FIRST_SEASON) return NextResponse.json({ error: "BioBuzz solo admite la temporada FTC 2026–2027 (FIRST 2026)." }, { status: 400 });
  try {
    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    const pageResults = new Map<number, Awaited<ReturnType<typeof getFirstJson>>>();
    const { events, pageTotal } = await getAllFirstEventPages(async page => {
      const value = await getFirstJson({
        key: `events:${season}:page:${page}`,
        season,
        url: `https://ftc-api.firstinspires.org/v2.0/${season}/events?page=${page}`,
        refresh,
      });
      pageResults.set(page, value);
      return value.payload;
    });
    const firstPage = pageResults.get(1);
    if (!firstPage) throw new Error("FIRST no devolvió la primera página de eventos.");
    const warnings = [...new Set([...pageResults.values()].map(value => value.warning).filter((warning): warning is string => Boolean(warning)))];
    return NextResponse.json({
      season,
      events: normalizeEvents({ events }, season),
      eventCount: events.length,
      pageTotal,
      syncedAt: firstPage.syncedAt,
      lastModified: firstPage.lastModified,
      persisted: [...pageResults.values()].every(value => value.stored),
      stale: [...pageResults.values()].some(value => value.stale ?? false),
      warning: warnings.length ? warnings.join(" ") : null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof FirstApiError) return NextResponse.json({ error: error.message, retryAfter: error.retryAfter, upstreamStatus: error.upstreamStatus, upstreamIssue: error.upstreamIssue }, { status: error.status });
    return NextResponse.json({ error: error instanceof Error ? error.message : "No fue posible consultar FTC Events." }, { status: 502 });
  }
}
