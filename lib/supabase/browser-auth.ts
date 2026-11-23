"use client";

import { createSupabaseBrowserClient } from "./client";
import { ACTIVE_WORKSPACE_STORAGE_KEY } from "@/lib/workspaces/constants";

export async function signOutSupabase(): Promise<void> {
  const client = createSupabaseBrowserClient();
  if (!client) throw new Error("No se pudo validar la configuración de autenticación.");
  const { error } = await client.auth.signOut();
  if (error) throw error;
  localStorage.removeItem(ACTIVE_WORKSPACE_STORAGE_KEY);
}
