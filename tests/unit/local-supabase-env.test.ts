import assert from "node:assert/strict";
import test from "node:test";
import { getLocalSupabaseTestEnv } from "../../lib/e2e/local-supabase-env.ts";

test("Playwright only receives credentials for an explicitly enabled loopback Supabase URL", () => {
  const remote = getLocalSupabaseTestEnv("1", "https://remote-project.supabase.co", "not-a-real-key");
  assert.equal(remote.PLAYWRIGHT_LOCAL_SUPABASE, "");
  assert.equal(remote.NEXT_PUBLIC_SUPABASE_URL, "");
  assert.equal(remote.NEXT_PUBLIC_SUPABASE_ANON_KEY, "");

  const withoutOptIn = getLocalSupabaseTestEnv(undefined, "http://127.0.0.1:54321", "local-key");
  assert.equal(withoutOptIn.NEXT_PUBLIC_SUPABASE_URL, "");

  const local = getLocalSupabaseTestEnv("1", "http://127.0.0.1:54321", "local-key");
  assert.equal(local.PLAYWRIGHT_LOCAL_SUPABASE, "1");
  assert.equal(local.NEXT_PUBLIC_SUPABASE_URL, "http://127.0.0.1:54321");
});
