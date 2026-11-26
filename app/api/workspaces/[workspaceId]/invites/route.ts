import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getWorkspaceRole } from "@/lib/supabase/workspace-access";

type Context = { params: Promise<{ workspaceId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request, { params }: Context) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Supabase no está configurado." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Inicia sesión para crear una invitación." }, { status: 401 });
  const { workspaceId } = await params;
  if (!uuid.test(workspaceId)) return NextResponse.json({ error: "El workspace no es válido." }, { status: 400 });
  const role = await getWorkspaceRole(supabase, workspaceId, user.id);
  if (role !== "admin") return NextResponse.json({ error: "Solo un Admin del workspace puede invitar miembros." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "JSON inválido." }, { status: 400 }); }
  const values = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const email = typeof values.email === "string" ? values.email.trim().toLowerCase() : "";
  const inviteRole = values.role;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Ingresa un correo válido." }, { status: 400 });
  if (inviteRole !== "scout" && inviteRole !== "viewer") return NextResponse.json({ error: "El rol de invitación debe ser Scout o Solo lectura." }, { status: 400 });

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { error } = await supabase.from("workspace_invites").insert({
    workspace_id: workspaceId, email, role: inviteRole, token_hash: `\\x${tokenHash}`,
    expires_at: new Date(Date.now() + 7 * 86400000).toISOString(), created_by: user.id,
  });
  if (error) {
    console.error("[POST /api/workspaces/:id/invites] insert failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "No se pudo crear la invitación. Revisa que la migración base esté instalada y tu rol Admin." }, { status: 500 });
  }
  return NextResponse.json({ token, expiresInDays: 7 }, { status: 201 });
}
