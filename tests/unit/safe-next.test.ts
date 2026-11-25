import assert from "node:assert/strict";
import test from "node:test";
import { safeNextPath } from "../../lib/auth/safe-next.ts";

const origin = "https://biobuzz.example";

test("accepts safe internal paths including auth destinations and query strings", () => {
  assert.equal(safeNextPath("/", origin), "/");
  assert.equal(safeNextPath("/analytics?season=2026#teams", origin), "/analytics?season=2026#teams");
  assert.equal(safeNextPath("/auth/recovery", origin), "/auth/recovery");
});

test("rejects absolute, external, protocol-relative, backslash, and encoded redirect targets", () => {
  for (const value of ["https://evil.example/path", "//evil.example/path", "/\\evil.example", "/%5cevil.example", "/%255cevil.example", "/%2f%2fevil.example", "/%252f%252fevil.example", "\\\\evil.example", "/%00evil", "/%zz"]) {
    assert.equal(safeNextPath(value, origin), "/", value);
  }
  assert.equal(safeNextPath(null, origin), "/");
});
