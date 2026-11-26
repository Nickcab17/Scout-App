import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Inicia sesión para aceptar una invitación." }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const token = body && typeof body === "object" && "token" in body && typeof body.token === "string" ? body.token.trim() : "";
  if (token.length < 32 || token.length > 128) return NextResponse.json({ error: "El código de invitación no es válido." }, { status: 400 });
  const { data: workspaceId, error } = await supabase.rpc("accept_workspace_invite", { invite_token: token });
  if (error) {
    console.error("[POST /api/workspaces/invites/accept] RPC failed", { code: error.code, message: error.message });
    const unconfigured = error.code === "PGRST202" || error.code === "42883";
    return NextResponse.json({ error: unconfigured ? "Falta instalar la migración base que habilita invitaciones." : "La invitación es inválida, venció o fue creada para otro correo." }, { status: unconfigured ? 503 : 400 });
  }
  if (typeof workspaceId !== "string") return NextResponse.json({ error: "No se confirmó la membresía de la invitación." }, { status: 500 });
  return NextResponse.json({ workspaceId });
}
