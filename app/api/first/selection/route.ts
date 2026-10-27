import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para leer la selección del grupo." }, { status: 401 });
  const workspaceId = new URL(request.url).searchParams.get("workspaceId") ?? "";
  if (!uuid.test(workspaceId)) return NextResponse.json({ error: "El grupo no es válido." }, { status: 400 });
  const { data, error } = await supabase.from("workspace_event_selections").select("season,event_code,updated_at").eq("workspace_id", workspaceId).maybeSingle();
  if (error) return NextResponse.json({ error: "No se pudo leer el evento seleccionado para este grupo." }, { status: 403 });
  return NextResponse.json({ selection: data ? { season: data.season, eventCode: data.event_code, updatedAt: data.updated_at } : null });
}

export async function PUT(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sesión para guardar la selección del grupo." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Faltan los datos de selección." }, { status: 400 });
  const row = body as Record<string, unknown>;
  if (typeof row.workspaceId !== "string" || !uuid.test(row.workspaceId) || !Number.isInteger(row.season) || Number(row.season) < 2023 || typeof row.eventCode !== "string" || !/^[a-z\d]{3,30}$/i.test(row.eventCode)) {
    return NextResponse.json({ error: "La temporada o el evento no son válidos." }, { status: 400 });
  }
  const { error } = await supabase.from("workspace_event_selections").upsert({ workspace_id: row.workspaceId, season: row.season, event_code: row.eventCode.toUpperCase(), updated_by: user.id, updated_at: new Date().toISOString() }, { onConflict: "workspace_id" });
  if (error) return NextResponse.json({ error: "No se pudo guardar la selección. Comprueba el rol de tu cuenta en el grupo." }, { status: 403 });
  return NextResponse.json({ saved: true });
}
