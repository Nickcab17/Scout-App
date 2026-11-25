import assert from "node:assert/strict";
import test from "node:test";
import { selectNewObservationRows, type ObservationIdentity } from "../../lib/scouting/observation-insert.ts";
import { buildAllianceCompatibility, getTeamStats } from "../../lib/analytics.ts";
import { emptyRobotScoutingInput } from "../../lib/scoring.ts";
import type { AppData } from "../../lib/types.ts";

type Row = ObservationIdentity & { workspace_id: string; notes: string };
const row = (workspace_id: string, id: string, match_id: string, team_number: number, notes: string): Row => ({ workspace_id, id, match_id, team_number, notes });

test("first capture and another team are accepted; a repeated team is rejected without changing the first row", () => {
  const first = row("w1", "o1", "m1", 9101, "first capture");
  const otherTeam = row("w1", "o2", "m1", 9102, "other team");
  let result = selectNewObservationRows([first], []);
  assert.deepEqual(result.rows, [first]);
  const saved = [...result.rows];
  result = selectNewObservationRows([otherTeam], saved);
  saved.push(...result.rows);
  assert.deepEqual(result.rows, [otherTeam]);
  result = selectNewObservationRows([row("w1", "o3", "m1", 9101, "replacement data")], saved);
  assert.equal(result.duplicate, true);
  assert.equal(result.rows.length, 0);
  assert.deepEqual(saved[0], first);
});

test("same team and match can be recorded independently in different workspaces", () => {
  const first = row("w1", "o1", "m1", 9101, "workspace one");
  const second = row("w2", "o2", "m1", 9101, "workspace two");
  assert.deepEqual(selectNewObservationRows([first], []).rows, [first]);
  assert.deepEqual(selectNewObservationRows([second], []).rows, [second]);
});

test("simultaneous inserts rely on an atomic unique-key check and keep the winning capture", async () => {
  const rows: Row[] = [];
  const atomicInsert = async (candidate: Row) => {
    await Promise.resolve();
    if (rows.some(saved => saved.workspace_id === candidate.workspace_id && saved.match_id === candidate.match_id && saved.team_number === candidate.team_number)) return false;
    rows.push(candidate);
    return true;
  };
  const first = row("w1", "o1", "m1", 9101, "simultaneous A");
  const second = row("w1", "o2", "m1", 9101, "simultaneous B");
  const results = await Promise.all([atomicInsert(first), atomicInsert(second)]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal(rows.length, 1);
  assert.ok([first.notes, second.notes].includes(rows[0].notes));
});

test("existing observations remain available to analytics and alliance compatibility", () => {
  const scoring = emptyRobotScoutingInput();
  scoring.auto.leave = true;
  const observation = { id: "old", matchId: "m1", teamNumber: 9101, status: "submitted" as const, auto: "", teleop: "", hiveTip: "", pollen: "", nectar: "", flowerGarden: "", leavePark: "", issues: "", notes: "historic", updatedAt: "2026-01-01", scoring, scoringConfirmed: true };
  const data: AppData = {
    teams: [{ id: "team", number: 9101, name: "Team", capabilities: "", autonomous: "", mechanical: "", notes: "", status: "pending", createdAt: "2026-01-01" }],
    matches: [{ id: "m1", number: 1, event: "Event", teams: ["9101", "9102", "9201", "9202"], createdAt: "2026-01-01" }],
    observations: [observation],
  };
  assert.equal(getTeamStats(data)[0].records[0].observation.id, "old");
  assert.equal(buildAllianceCompatibility(getTeamStats(data)).length, 1);
});
