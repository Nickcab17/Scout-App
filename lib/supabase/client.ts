import { createBrowserClient } from "@supabase/ssr";
import { getSupabasePublicConfig } from "./config";

export function createSupabaseBrowserClient() {
  const config = getSupabasePublicConfig();
  return config ? createBrowserClient(config.url, config.anonKey) : null;
}
