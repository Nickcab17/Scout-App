import { NextResponse } from "next/server";
import { validateImport } from "@/lib/persistence";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AppData } from "@/lib/types";

type Context = { params: Promise<{ workspaceId: string }> };
const fail = (message: string, status = 400) => NextResponse.json({ error: message }, { status });

async function authenticatedClient() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: fail("Supabase no está configurado.", 503) } as const;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { error: fail("Inicia sesión para acceder a los datos del grupo.", 401) } as const;
  return { supabase, user } as const;
}

export async function GET(_request: Request, { params }: Context) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const { workspaceId } = await params;
  const [teamsResult, matchesResult, observationsResult] = await Promise.all([
    auth.supabase.from("teams").select("id,number,name,capabilities,autonomous,mechanical,notes,status,created_at").eq("workspace_id", workspaceId),
    auth.supabase.from("matches").select("id,number,event,event_type,teams,created_at").eq("workspace_id", workspaceId),
    auth.supabase.from("observations").select("id,match_id,team_number,status,auto,teleop,hive_tip,pollen,nectar,flower_garden,leave_park,issues,notes,scout_name,scoring_input,updated_at").eq("workspace_id", workspaceId),
  ]);
  const dbError = teamsResult.error ?? matchesResult.error ?? observationsResult.error;
  if (dbError) return fail("No se pudieron leer los datos de este grupo.", 403);
  const data: AppData = {
    teams: (teamsResult.data ?? []).map(row => ({ id: row.id, number: row.number, name: row.name, capabilities: row.capabilities, autonomous: row.autonomous, mechanical: row.mechanical, notes: row.notes, status: row.status, createdAt: row.created_at })),
    matches: (matchesResult.data ?? []).map(row => ({ id: row.id, number: row.number, event: row.event, eventType: row.event_type, teams: row.teams as [string,string,string,string], createdAt: row.created_at })),
    observations: (observationsResult.data ?? []).map(row => ({ id: row.id, matchId: row.match_id, teamNumber: row.team_number, status: row.status, auto: row.auto, teleop: row.teleop, hiveTip: row.hive_tip, pollen: row.pollen, nectar: row.nectar, flowerGarden: row.flower_garden, leavePark: row.leave_park, issues: row.issues, notes: row.notes, scoutName: row.scout_name ?? undefined, scoring: row.scoring_input ?? undefined, scoringConfirmed: row.scoring_input !== null, updatedAt: row.updated_at })),
  };
  return NextResponse.json({ data });
}

export async function PUT(request: Request, { params }: Context) {
  const auth = await authenticatedClient();
  if ("error" in auth) return auth.error;
  const { workspaceId } = await params;
  let body: unknown;
  try { body = await request.json(); } catch { return fail("Solicitud JSON inválida."); }
  if (typeof body !== "object" || body === null || !("data" in body)) return fail("Falta el contenido de scouting.");
  let data: AppData;
  try { data = validateImport((body as { data: unknown }).data); } catch (error) { return fail(error instanceof Error ? error.message : "Datos inválidos."); }
  const deletes = "deleteIds" in body && typeof body.deleteIds === "object" && body.deleteIds !== null ? body.deleteIds as Record<string, unknown> : {};
  const teamRows = data.teams.map(row => ({ id: row.id, workspace_id: workspaceId, number: row.number, name: row.name, capabilities: row.capabilities, autonomous: row.autonomous, mechanical: row.mechanical, notes: row.notes, status: row.status, created_at: row.createdAt }));
  const matchRows = data.matches.map(row => ({ id: row.id, workspace_id: workspaceId, number: row.number, event: row.event, event_type: row.eventType ?? "not_configured", teams: row.teams, created_at: row.createdAt }));
  const observationRows = data.observations.map(row => ({ id: row.id, workspace_id: workspaceId, match_id: row.matchId, team_number: row.teamNumber, scout_user_id: auth.user.id, status: row.status, auto: row.auto, teleop: row.teleop, hive_tip: row.hiveTip, pollen: row.pollen, nectar: row.nectar, flower_garden: row.flowerGarden, leave_park: row.leavePark, issues: row.issues, notes: row.notes, scout_name: row.scoutName ?? "", scoring_input: row.scoringConfirmed ? row.scoring ?? null : null, updated_at: row.updatedAt }));
  const operations = [
    teamRows.length ? auth.supabase.from("teams").upsert(teamRows, { onConflict: "workspace_id,id" }) : null,
    matchRows.length ? auth.supabase.from("matches").upsert(matchRows, { onConflict: "workspace_id,id" }) : null,
    observationRows.length ? auth.supabase.from("observations").upsert(observationRows, { onConflict: "workspace_id,match_id,team_number" }) : null,
  ];
  for (const operation of operations) {
    if (!operation) continue;
    const { error } = await operation;
    if (error) return fail("El servidor rechazó el guardado del grupo. Revisa membresía, RLS y conflictos.", 409);
  }
  for (const [table, key] of [["observations", "observations"], ["matches", "matches"], ["teams", "teams"]] as const) {
    const ids = deletes[key];
    if (!Array.isArray(ids) || !ids.length || ids.some(id => typeof id !== "string")) continue;
    const { error } = await auth.supabase.from(table).delete().eq("workspace_id", workspaceId).in("id", ids);
    if (error) return fail("Los datos se guardaron, pero no se pudo confirmar una eliminación.", 409);
  }
  return NextResponse.json({ saved: true, workspaceId, updatedAt: new Date().toISOString() });
}
