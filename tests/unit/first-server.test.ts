import assert from "node:assert/strict";
import test from "node:test";
import { FirstApiError, getFirstJson } from "../../lib/first/cache.ts";

const originalFetch = globalThis.fetch;
const originalUsername = process.env.FTC_EVENTS_USERNAME;
const originalKey = process.env.FTC_EVENTS_AUTHORIZATION_KEY;

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUsername === undefined) delete process.env.FTC_EVENTS_USERNAME;
  else process.env.FTC_EVENTS_USERNAME = originalUsername;
  if (originalKey === undefined) delete process.env.FTC_EVENTS_AUTHORIZATION_KEY;
  else process.env.FTC_EVENTS_AUTHORIZATION_KEY = originalKey;
});

test("reports missing credentials without making an upstream request", async () => {
  delete process.env.FTC_EVENTS_USERNAME;
  delete process.env.FTC_EVENTS_AUTHORIZATION_KEY;
  globalThis.fetch = async () => { throw new Error("fetch should not run"); };
  await assert.rejects(getFirstJson({ key: "test:missing-credentials", season: 2026, url: "https://ftc-api.firstinspires.org/v2.0", refresh: true }), error => {
    assert.ok(error instanceof FirstApiError);
    assert.equal(error.status, 503);
    return true;
  });
});

test("maps authentication failures to a safe error without exposing configured credentials", async () => {
  process.env.FTC_EVENTS_USERNAME = "test-user-never-display";
  process.env.FTC_EVENTS_AUTHORIZATION_KEY = "test-key-never-display";
  globalThis.fetch = async () => new Response("Unauthorized", { status: 401 });
  await assert.rejects(getFirstJson({ key: "test:auth-rejected", season: 2026, url: "https://ftc-api.firstinspires.org/v2.0", refresh: true }), error => {
    assert.ok(error instanceof FirstApiError);
    assert.equal(error.status, 502);
    assert.equal(error.message.includes("test-user-never-display"), false);
    assert.equal(error.message.includes("test-key-never-display"), false);
    return true;
  });
});

test("keeps the last valid response and marks it stale after a network failure", async () => {
  process.env.FTC_EVENTS_USERNAME = "test-user";
  process.env.FTC_EVENTS_AUTHORIZATION_KEY = "test-key";
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    if (calls === 1) return new Response(JSON.stringify({ events: [{ code: "USALATQ" }] }), { status: 200, headers: { "content-type": "application/json", "last-modified": "Tue, 27 Oct 2026 12:00:00 GMT" } });
    throw new TypeError("network unavailable");
  };
  const options = { key: "test:stale-fallback", season: 2026, url: "https://ftc-api.firstinspires.org/v2.0/2026/events", refresh: true };
  const valid = await getFirstJson(options);
  const stale = await getFirstJson(options);
  assert.deepEqual(stale.payload, valid.payload);
  assert.equal(stale.stale, true);
  assert.equal(stale.lastModified, valid.lastModified);
  assert.equal(calls, 2);
});

test("uses conditional requests and reuses the cached response on HTTP 304", async () => {
  process.env.FTC_EVENTS_USERNAME = "test-user";
  process.env.FTC_EVENTS_AUTHORIZATION_KEY = "test-key";
  let conditionalHeader: string | null = null;
  let calls = 0;
  globalThis.fetch = async (_input, init) => {
    calls++;
    conditionalHeader = new Headers(init?.headers).get("If-Modified-Since");
    if (calls === 1) return new Response(JSON.stringify({ events: [] }), { status: 200, headers: { "content-type": "application/json", "last-modified": "Tue, 27 Oct 2026 12:00:00 GMT" } });
    return new Response(null, { status: 304 });
  };
  const options = { key: "test:not-modified", season: 2026, url: "https://ftc-api.firstinspires.org/v2.0/2026/events", refresh: true };
  const valid = await getFirstJson(options);
  const updated = await getFirstJson(options);
  assert.equal(conditionalHeader, "Tue, 27 Oct 2026 12:00:00 GMT");
  assert.deepEqual(updated.payload, valid.payload);
  assert.equal(updated.stale, undefined);
  assert.equal(calls, 2);
});
