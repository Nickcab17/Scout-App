import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceRole } from "@/lib/supabase/workspace-access";
import { isWorkspaceRole } from "@/lib/workspaces/validation";

type Context = { params: Promise<{ workspaceId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorize(workspaceId: string) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return { response: NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 }) } as const;
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { response: NextResponse.json({ error: "Inicia sesión para administrar miembros." }, { status: 401 }) } as const;
  if (!uuid.test(workspaceId)) return { response: NextResponse.json({ error: "El workspace no es válido." }, { status: 400 }) } as const;
  const role = await getWorkspaceRole(supabase, workspaceId, user.id);
  if (!role) return { response: NextResponse.json({ error: "No tienes acceso a este workspace." }, { status: 403 }) } as const;
  return { supabase, user, role } as const;
}

export async function GET(_request: Request, { params }: Context) {
  const { workspaceId } = await params;
  const auth = await authorize(workspaceId);
  if ("response" in auth) return auth.response;
  if (auth.role !== "admin") return NextResponse.json({ error: "Solo un Admin puede consultar la lista de miembros." }, { status: 403 });
  const { data, error } = await auth.supabase.from("workspace_members").select("user_id,role").eq("workspace_id", workspaceId);
  if (error) return NextResponse.json({ error: "No se pudieron cargar los miembros." }, { status: 500 });
  return NextResponse.json({ members: data ?? [] });
}

export async function PATCH(request: Request, { params }: Context) {
  const { workspaceId } = await params;
  const auth = await authorize(workspaceId);
  if ("response" in auth) return auth.response;
  if (auth.role !== "admin") return NextResponse.json({ error: "Solo un Admin puede cambiar roles." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const values = body && typeof body === "object" ? body as Record<string, unknown> : {};
  if (typeof values.userId !== "string" || !uuid.test(values.userId) || !isWorkspaceRole(values.role)) return NextResponse.json({ error: "El miembro o rol no es válido." }, { status: 400 });
  const { data, error } = await auth.supabase.from("workspace_members").update({ role: values.role }).eq("workspace_id", workspaceId).eq("user_id", values.userId).select("user_id,role").maybeSingle();
  if (error || !data) return NextResponse.json({ error: "No se pudo cambiar el rol. Solo un Admin puede hacer este cambio." }, { status: error ? 403 : 404 });
  return NextResponse.json({ member: data });
}
