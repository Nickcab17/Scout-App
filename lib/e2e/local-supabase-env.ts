const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function getLocalSupabaseTestEnv(enabled: string | undefined, url: string | undefined, anonKey: string | undefined) {
  let host = "";
  try { host = new URL(url ?? "").hostname; } catch { /* Invalid URLs stay disabled. */ }
  const ready = enabled === "1" && loopbackHosts.has(host) && Boolean(anonKey);
  return {
    PLAYWRIGHT_LOCAL_SUPABASE: ready ? "1" : "",
    NEXT_PUBLIC_SUPABASE_URL: ready ? url! : "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ready ? anonKey! : "",
  };
}
