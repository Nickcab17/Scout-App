import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeWorkspaceName } from "@/lib/workspaces/validation";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Inicia sesión para ver tus grupos." }, { status: 401 });
  const { data: memberships, error: membershipsError } = await supabase.from("workspace_members").select("workspace_id,role").eq("user_id", user.id);
  if (membershipsError) {
    console.error("[GET /api/workspaces] membership query failed", { code: membershipsError.code, message: membershipsError.message, details: membershipsError.details, hint: membershipsError.hint });
    const missingSchema = membershipsError.code === "42P01" || membershipsError.code === "PGRST205";
    return NextResponse.json({ error: missingSchema ? "La base de datos de BioBuzz aún no está inicializada. Ejecuta primero la migración base de BioBuzz y después las migraciones posteriores." : "No se pudieron cargar los grupos. Revisa la conexión y las políticas RLS de workspace_members.", code: missingSchema ? "WORKSPACE_SCHEMA_NOT_INITIALIZED" : "WORKSPACE_MEMBERS_QUERY_FAILED" }, { status: missingSchema ? 503 : 500 });
  }
  const workspaceIds = (memberships ?? []).map(item => item.workspace_id);
  const { data: workspaceRows, error: workspacesError } = workspaceIds.length
    ? await supabase.from("workspaces").select("id,name").in("id", workspaceIds)
    : { data: [], error: null };
  if (workspacesError) {
    console.error("[GET /api/workspaces] workspace query failed", { code: workspacesError.code, message: workspacesError.message, details: workspacesError.details, hint: workspacesError.hint });
    const missingSchema = workspacesError.code === "42P01" || workspacesError.code === "PGRST205";
    return NextResponse.json({ error: missingSchema ? "La base de datos de BioBuzz aún no está inicializada. Ejecuta primero la migración base de BioBuzz y después las migraciones posteriores." : "No se pudieron cargar los grupos. Revisa la conexión y las políticas RLS de workspaces.", code: missingSchema ? "WORKSPACE_SCHEMA_NOT_INITIALIZED" : "WORKSPACE_DETAILS_QUERY_FAILED" }, { status: missingSchema ? 503 : 500 });
  }
  const workspacesById = new Map((workspaceRows ?? []).map(workspace => [workspace.id, workspace]));
  return NextResponse.json({
    user: { id: user.id, email: user.email ?? null },
    workspaces: (memberships ?? []).flatMap(item => {
      const workspace = workspacesById.get(item.workspace_id);
      return workspace ? [{ ...workspace, role: item.role }] : [];
    }),
  });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Inicia sesión para crear un grupo." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud JSON inválida." }, { status: 400 }); }
  const name = normalizeWorkspaceName(typeof body === "object" && body !== null && "name" in body ? body.name : null);
  if (!name) return NextResponse.json({ error: "El nombre debe tener entre 2 y 100 caracteres después de quitar espacios." }, { status: 400 });
  const { data, error } = await supabase.rpc("create_workspace_with_owner", { p_name: name });
  if (error) {
    console.error("[POST /api/workspaces] atomic workspace creation failed", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    if (error.code === "PGRST202" || error.code === "42883") {
      return NextResponse.json({ error: "La creación segura de grupos no está inicializada. Falta aplicar la migración de onboarding de workspaces.", code: "WORKSPACE_ONBOARDING_NOT_CONFIGURED" }, { status: 503 });
    }
    const missingSchema = error.code === "42P01" || error.code === "PGRST205";
    return NextResponse.json({ error: missingSchema ? "Falta instalar el esquema base de BioBuzz en Supabase." : "No se pudo crear el grupo de forma segura. Comprueba los permisos de ejecución de la RPC y el trigger workspace_owner_membership." , code: missingSchema ? "WORKSPACE_SCHEMA_NOT_INITIALIZED" : "WORKSPACE_CREATE_FAILED" }, { status: missingSchema ? 503 : 500 });
  }
  const workspace = data as { id: string; name: string; role: "admin" } | null;
  if (!workspace?.id || workspace.role !== "admin") {
    console.error("[POST /api/workspaces] atomic function returned an invalid result");
    return NextResponse.json({ error: "No se confirmó la membresía Admin del grupo.", code: "WORKSPACE_ADMIN_MEMBERSHIP_UNCONFIRMED" }, { status: 500 });
  }
  return NextResponse.json({ workspace }, { status: 201 });
}
