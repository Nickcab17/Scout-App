import { defineConfig, devices } from "@playwright/test";
import { getLocalSupabaseTestEnv } from "./lib/e2e/local-supabase-env";

const localSupabaseEnv = getLocalSupabaseTestEnv(
  process.env.PLAYWRIGHT_LOCAL_SUPABASE,
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure", ...devices["Desktop Chrome"] },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    env: {
      PLAYWRIGHT_E2E: "1",
      ...localSupabaseEnv,
    },
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
