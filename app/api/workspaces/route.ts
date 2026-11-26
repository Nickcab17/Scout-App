import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeWorkspaceName } from "@/lib/workspaces/validation";

type WorkspaceCreateError = {
  code?: unknown;
  message?: unknown;
  details?: unknown;
  hint?: unknown;
};

function logWorkspaceCreationFailure(stage: string, error: unknown) {
  const fields = error && typeof error === "object" ? error as WorkspaceCreateError : {};
  console.error("[POST /api/workspaces] workspace creation failed", {
    stage,
    code: typeof fields.code === "string" ? fields.code : null,
    message: typeof fields.message === "string" ? fields.message : error instanceof Error ? error.message : "Unknown error",
    details: typeof fields.details === "string" ? fields.details : null,
    hint: typeof fields.hint === "string" ? fields.hint : null,
  });
}

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
  let data: unknown;
  let error: WorkspaceCreateError | null = null;
  try {
    const rpcResult = await supabase.rpc("create_workspace_with_owner", { p_name: name });
    data = rpcResult.data;
    error = rpcResult.error;
  } catch (error) {
    logWorkspaceCreationFailure("rpc.create_workspace_with_owner.transport", error);
    return NextResponse.json({ error: "No se pudo crear el grupo de forma segura. Comprueba los permisos de ejecución de la RPC y el trigger workspace_owner_membership.", code: "WORKSPACE_CREATE_FAILED" }, { status: 500 });
  }
  if (error) {
    logWorkspaceCreationFailure("rpc.create_workspace_with_owner", error);
    if (error.code === "PGRST202" || error.code === "42883") {
      return NextResponse.json({ error: "La creación segura de grupos no está inicializada. Falta aplicar la migración de onboarding de workspaces.", code: "WORKSPACE_ONBOARDING_NOT_CONFIGURED" }, { status: 503 });
    }
    const missingSchema = error.code === "42P01" || error.code === "PGRST205";
    return NextResponse.json({ error: missingSchema ? "Falta instalar el esquema base de BioBuzz en Supabase." : "No se pudo crear el grupo de forma segura. Comprueba los permisos de ejecución de la RPC y el trigger workspace_owner_membership." , code: missingSchema ? "WORKSPACE_SCHEMA_NOT_INITIALIZED" : "WORKSPACE_CREATE_FAILED" }, { status: missingSchema ? 503 : 500 });
  }
  const workspace = data as { id: string; name: string; role: "admin" } | null;
  if (!workspace?.id || workspace.role !== "admin") {
    logWorkspaceCreationFailure("rpc.create_workspace_with_owner.response_validation", {
      code: "WORKSPACE_ADMIN_MEMBERSHIP_UNCONFIRMED",
      message: "RPC returned an invalid workspace payload or a role other than admin.",
      details: null,
      hint: null,
    });
    return NextResponse.json({ error: "No se confirmó la membresía Admin del grupo.", code: "WORKSPACE_ADMIN_MEMBERSHIP_UNCONFIRMED" }, { status: 500 });
  }
  return NextResponse.json({ workspace }, { status: 201 });
}
