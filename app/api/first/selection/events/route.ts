import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupportedFirstSeason } from "@/lib/first/season";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const eventCode = /^[a-z\d]{3,30}$/i;

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Inicia sesión para leer las selecciones del grupo." }, { status: 401 });
  const url = new URL(request.url);
  const workspaceId = url.searchParams.get("workspaceId") ?? "";
  const season = Number(url.searchParams.get("season"));
  if (!uuid.test(workspaceId) || !isSupportedFirstSeason(season)) return NextResponse.json({ error: "El grupo o la temporada no son válidos." }, { status: 400 });
  const { data, error } = await supabase.from("workspace_regional_selections").select("event_code").eq("workspace_id", workspaceId).eq("season", season).order("event_code");
  if (error) return NextResponse.json({ error: "No se pudieron leer las selecciones guardadas del grupo." }, { status: 403 });
  return NextResponse.json({ eventCodes: (data ?? []).map(row => row.event_code) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Inicia sesión para guardar selecciones del grupo." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Faltan los datos de selección." }, { status: 400 });
  const row = body as Record<string, unknown>;
  if (typeof row.workspaceId !== "string" || !uuid.test(row.workspaceId) || typeof row.season !== "number" || !isSupportedFirstSeason(row.season) || !Array.isArray(row.eventCodes) || row.eventCodes.length > 200 || row.eventCodes.some(code => typeof code !== "string" || !eventCode.test(code))) {
    return NextResponse.json({ error: "El grupo, la temporada o los códigos de evento no son válidos." }, { status: 400 });
  }
  const normalizedCodes = [...new Set((row.eventCodes as string[]).map(code => code.toUpperCase()))];
  const { error } = await supabase.rpc("save_workspace_regional_selections", {
    p_workspace_id: row.workspaceId,
    p_season: row.season,
    p_event_codes: normalizedCodes,
  });
  if (error) {
    console.error("[PUT /api/first/selection/events] save failed", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    return NextResponse.json({ error: "No se pudieron guardar las selecciones. Comprueba tu rol y que esté aplicada la migración de regionales." }, { status: error.code === "PGRST202" || error.code === "42883" ? 503 : 403 });
  }
  return NextResponse.json({ saved: true, eventCodes: normalizedCodes });
}
