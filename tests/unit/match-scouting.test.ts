import test from "node:test";
import assert from "node:assert/strict";
import { buildFirstMatchAndObservation, findRobotAlliance, parsePollenCount, type FirstRobotMatch } from "../../lib/first/match-scouting.ts";

const match: FirstRobotMatch = {
  id: "2026:AUBRQ1:qual:0:14",
  season: 2026,
  eventCode: "AUBRQ1",
  level: "qual",
  number: 14,
  description: "Qualification 14",
  redTeams: [{ number: 9101, name: "A" }, { number: 9102, name: "B" }],
  blueTeams: [{ number: 9201, name: "C" }, { number: 9202, name: "D" }],
};

test("pollen accepts zero and positive integers only", () => {
  assert.equal(parsePollenCount("0"), 0);
  assert.equal(parsePollenCount("12"), 12);
  assert.equal(parsePollenCount("-1"), null);
  assert.equal(parsePollenCount("1.5"), null);
  assert.equal(parsePollenCount("abc"), null);
  assert.equal(parsePollenCount(""), null);
});

test("robots are associated with the correct FIRST alliance", () => {
  assert.equal(findRobotAlliance(match, 9101), "red");
  assert.equal(findRobotAlliance(match, 9202), "blue");
  assert.equal(findRobotAlliance(match, 9999), null);
});

test("FIRST metadata and pollen are stored without invented scoring values", () => {
  const result = buildFirstMatchAndObservation(match, 9102, 0, { matches: [], observations: [] });
  assert.equal(result.observation.pollenCount, 0);
  assert.equal(result.observation.pollen, "0");
  assert.equal(result.observation.alliance, "red");
  assert.equal(result.observation.season, 2026);
  assert.equal(result.observation.eventCode, "AUBRQ1");
  assert.equal(result.observation.tournamentLevel, "qual");
  assert.equal(result.observation.officialMatchId, match.id);
  assert.equal(result.observation.scoringConfirmed, undefined);
});

test("each capture creates a new observation instead of overwriting the previous record", () => {
  const first = buildFirstMatchAndObservation(match, 9102, 0, { matches: [], observations: [] });
  const second = buildFirstMatchAndObservation(match, 9102, 7, {
    matches: [first.localMatch],
    observations: [first.observation],
  });
  assert.notEqual(first.observation.id, second.observation.id);
  assert.equal(second.observation.pollenCount, 7);
  assert.equal(second.observation.matchId, first.localMatch.id);
});
