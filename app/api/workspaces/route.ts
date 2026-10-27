import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Inicia sesión para ver tus grupos." }, { status: 401 });
  const { data, error } = await supabase.from("workspace_members").select("workspace_id,role,workspaces!inner(id,name)").eq("user_id", user.id);
  if (error) return NextResponse.json({ error: "No se pudieron cargar los grupos." }, { status: 403 });
  return NextResponse.json({ workspaces: (data ?? []).map((item) => ({ id: item.workspace_id, role: item.role, ...(item.workspaces as unknown as { name: string }) })) });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Inicia sesión para crear un grupo." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Solicitud JSON inválida." }, { status: 400 }); }
  const name = typeof body === "object" && body !== null && "name" in body && typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 2 || name.length > 100) return NextResponse.json({ error: "El nombre debe tener entre 2 y 100 caracteres." }, { status: 400 });
  const { data, error } = await supabase.from("workspaces").insert({ name, created_by: user.id }).select("id,name").single();
  if (error) return NextResponse.json({ error: "No se pudo crear el grupo." }, { status: 403 });
  return NextResponse.json({ workspace: { ...data, role: "admin" } }, { status: 201 });
}
