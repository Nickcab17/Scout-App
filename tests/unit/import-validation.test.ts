import assert from "node:assert/strict";
import test from "node:test";
import { mergeLegacyData } from "../../lib/import-validation.ts";
import { emptyData } from "../../lib/types.ts";

const team = { id: "team-1", number: 1234, name: "Bee", capabilities: "", autonomous: "", mechanical: "", notes: "", status: "pending" as const, createdAt: "2026-01-01T00:00:00.000Z" };

test("legacy migration inserts once and repeated import is idempotent", () => {
  const first = mergeLegacyData(emptyData, { ...emptyData, teams: [team] });
  assert.deepEqual(first.inserted, { teams: 1, matches: 0, observations: 0 });
  const retry = mergeLegacyData(first.data, { ...emptyData, teams: [team] });
  assert.deepEqual(retry.inserted, { teams: 0, matches: 0, observations: 0 });
  assert.equal(retry.data.teams.length, 1);
});

test("legacy migration reports a natural key conflict without overwriting", () => {
  const existing = { ...team, name: "Different name" };
  assert.throws(() => mergeLegacyData({ ...emptyData, teams: [existing] }, { ...emptyData, teams: [team] }), /Conflicto en el equipo/);
});
