export function normalizeWorkspaceName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 2 && name.length <= 100 ? name : null;
}

export function isWorkspaceRole(value: unknown): value is "admin" | "scout" | "viewer" {
  return value === "admin" || value === "scout" || value === "viewer";
}
