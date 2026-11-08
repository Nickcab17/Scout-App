import assert from "node:assert/strict";
import test from "node:test";
import { buildAllianceCompatibility, getTeamStats, rankTeamStats } from "../../lib/analytics.ts";
import { emptyRobotScoutingInput } from "../../lib/scoring.ts";
import type { AppData } from "../../lib/types.ts";

const team = (number: number) => ({ id: `team-${number}`, number, name: `Team ${number}`, capabilities: "", autonomous: "", mechanical: "", notes: "", status: "pending" as const, createdAt: "2026-01-01" });

function dataForTest(): AppData {
  const scoring = emptyRobotScoutingInput();
  scoring.auto.leave = true;
  scoring.auto.hiveTips = 1;
  scoring.teleop.hiveTips = 1;
  scoring.teleop.cells.pollen = 2;
  const matches = [
    { id: "m1", number: 1, event: "Evento prueba", teams: ["100", "101", "200", "201"] as [string,string,string,string], createdAt: "2026-01-01", season: 2026 },
    { id: "m2", number: 2, event: "Evento prueba", teams: ["100", "101", "200", "201"] as [string,string,string,string], createdAt: "2026-01-02", season: 2026 },
  ];
  const second = { ...scoring, auto: { ...scoring.auto, leave: false }, teleop: { ...scoring.teleop, cells: { pollen: 5, nectar: 0 } } };
  return {
    teams: [team(100), team(101)],
    matches,
    observations: [
      { id: "o1", matchId: "m1", teamNumber: 100, status: "submitted" as const, auto: "", teleop: "", hiveTip: "", pollen: "", nectar: "", flowerGarden: "", leavePark: "", issues: "", notes: "", updatedAt: "2026-01-01", scoring, scoringConfirmed: true },
      { id: "o2", matchId: "m2", teamNumber: 100, status: "submitted" as const, auto: "", teleop: "", hiveTip: "", pollen: "", nectar: "", flowerGarden: "", leavePark: "", issues: "", notes: "", updatedAt: "2026-01-02", scoring: second, scoringConfirmed: true },
      { id: "o3", matchId: "m1", teamNumber: 101, status: "draft" as const, auto: "Observación incompleta", teleop: "", hiveTip: "", pollen: "", nectar: "", flowerGarden: "", leavePark: "", issues: "", notes: "", updatedAt: "2026-01-01" },
    ],
  };
}

test("calculates real team statistics without treating incomplete records as confirmed scores", () => {
  const stats = getTeamStats(dataForTest());
  const team100 = stats.find(item => item.team.number === 100)!;
  assert.equal(team100.records.length, 2);
  assert.equal(team100.incomplete, 0);
  assert.equal(team100.matches, 2);
  assert.equal(team100.minimum < team100.maximum, true);
  assert.equal(team100.consistency >= 0 && team100.consistency <= 100, true);
});

test("counts incomplete records separately and ranks confirmed samples reproducibly", () => {
  const data = dataForTest();
  const stats = getTeamStats(data);
  const team101 = stats.find(item => item.team.number === 101)!;
  assert.equal(team101.incomplete, 1);
  assert.equal(team101.records.length, 0);
  const ranking = rankTeamStats(stats.filter(item => item.records.length));
  assert.equal(ranking.length, 1);
  assert.equal(ranking[0].team.number, 100);
});

test("explains alliance compatibility limitations when evidence is insufficient", () => {
  const stats = getTeamStats(dataForTest());
  const compatibility = buildAllianceCompatibility(stats);
  const limited = compatibility.find(item => item.team.number === 101)!;
  assert.ok(limited.limitations.includes("Sin scoring confirmado"));
});

test("season and event filters isolate scouting records between competitions", () => {
  const data = dataForTest();
  data.matches[0].season = 2026;
  data.matches[0].event = "Evento REAL A";
  data.matches[0].eventCode = "AUBRQ1";
  data.matches[1].season = 2025;
  data.matches[1].event = "Evento REAL B";
  data.matches[1].eventCode = "AUCTQ1";

  const first = getTeamStats(data, { season: "2026", event: "Evento REAL A", team: "100" });
  const second = getTeamStats(data, { season: "2025", event: "Evento REAL B", team: "100" });
  assert.equal(first.length, 1);
  assert.equal(first[0].records.length, 1);
  assert.equal(second.length, 1);
  assert.equal(second[0].records.length, 1);
  assert.notEqual(first[0].records[0].match?.id, second[0].records[0].match?.id);
});
