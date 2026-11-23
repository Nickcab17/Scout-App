import type { SupabaseClient } from "@supabase/supabase-js";

export type WorkspaceRole = "admin" | "scout" | "viewer";

export async function getWorkspaceRole(
  supabase: SupabaseClient,
  workspaceId: string,
  userId: string,
): Promise<WorkspaceRole | null> {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  if (data.role === "admin" || data.role === "scout" || data.role === "viewer") return data.role;
  return null;
}

export function canWriteWorkspace(role: WorkspaceRole): boolean {
  return role === "admin" || role === "scout";
}
