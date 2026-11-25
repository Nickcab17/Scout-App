import type { FullConfig } from "@playwright/test";

export default async function globalSetup(_config: FullConfig) {
  if (process.env.PLAYWRIGHT_LOCAL_SUPABASE !== "1") {
    throw new Error("E2E requieren Supabase local real: ejecuta npm run test:e2e:local. No se admite auth simulada ni Supabase remoto.");
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Configura URL y anon key de supabase status local antes de E2E.");
  const host = new URL(url).hostname;
  if (!(["localhost", "127.0.0.1", "::1"].includes(host))) throw new Error("Las pruebas E2E solo aceptan Supabase en loopback local.");
  const response = await fetch(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: key } });
  if (!response.ok) throw new Error(`Supabase Auth local no responde correctamente (HTTP ${response.status}). Ejecuta supabase start y supabase db reset.`);
}
