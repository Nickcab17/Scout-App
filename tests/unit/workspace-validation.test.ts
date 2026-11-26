import assert from "node:assert/strict";
import test from "node:test";
import { isWorkspaceRole, normalizeWorkspaceName } from "../../lib/workspaces/validation.ts";

test("workspace names are trimmed and must contain 2 to 100 characters", () => {
  assert.equal(normalizeWorkspaceName("  BioBuzz  "), "BioBuzz");
  assert.equal(normalizeWorkspaceName("  "), null);
  assert.equal(normalizeWorkspaceName("A"), null);
  assert.equal(normalizeWorkspaceName("x".repeat(101)), null);
  assert.equal(normalizeWorkspaceName(null), null);
});

test("only supported workspace roles are accepted", () => {
  assert.equal(isWorkspaceRole("admin"), true);
  assert.equal(isWorkspaceRole("scout"), true);
  assert.equal(isWorkspaceRole("viewer"), true);
  assert.equal(isWorkspaceRole("owner"), false);
});
