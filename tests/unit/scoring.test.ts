import assert from "node:assert/strict";
import test from "node:test";
import { BIOBUZZ_RULES, calculateAllianceRankingPoints, calculateRobotScore, compareEstimateToOfficial, emptyRobotScoutingInput, RULE_CONFIGURATIONS } from "../../lib/scoring.ts";

test("returns zero points for a confirmed empty record", () => {
  const score = calculateRobotScore(emptyRobotScoutingInput());
  assert.equal(score.totalMatchPoints, 0);
  assert.equal(score.autoPoints, 0);
  assert.equal(score.teleopPoints, 0);
  assert.equal(score.totalTips, 0);
  assert.equal(score.poolPoints, null);
  assert.equal(score.penaltyPoints, null);
});

test("scores every documented action using TU06 point values", () => {
  const input = emptyRobotScoutingInput();
  input.auto.leave = true;
  input.auto.park = true;
  input.auto.hiveTips = 1;
  input.teleop.park = true;
  input.teleop.hiveTips = 2;
  input.teleop.cells = { pollen: 2, nectar: 1 };
  input.teleop.flowers = { pollen: 1, nectar: 2 };
  input.teleop.bottomNectarBonusFlowers = 1;
  input.teleop.gardens = { pollen: 2, nectar: 3 };
  assert.deepEqual(calculateRobotScore(input), {
    autoPoints: 28, teleopPoints: 67, totalMatchPoints: 95, totalTips: 3,
    cellPoints: 6, flowerPoints: 6, gardenPoints: 5, bonusPoints: 5,
    penaltyPoints: null, estimated: true, ruleVersion: BIOBUZZ_RULES.version, poolPoints: null,
  });
});

test("validates integer counts and per-match flower bonus ceiling", () => {
  const input = emptyRobotScoutingInput();
  input.teleop.cells.pollen = -1;
  assert.throws(() => calculateRobotScore(input), RangeError);
  input.teleop.cells.pollen = 0;
  input.teleop.bottomNectarBonusFlowers = 5;
  assert.throws(() => calculateRobotScore(input), RangeError);
});

test("calculates alliance RP only from complete active robot records and correct thresholds", () => {
  const a = emptyRobotScoutingInput();
  const b = emptyRobotScoutingInput();
  a.auto.leave = true; a.auto.park = true; a.teleop.park = true;
  b.auto.leave = true; b.auto.park = true;
  a.auto.hiveTips = 2; b.teleop.hiveTips = 2;
  let rp = calculateAllianceRankingPoints({ robots: [a], activeRobotCount: 2, eventType: "all_other_events" });
  assert.equal(rp.swarmRP, null);
  assert.equal(rp.pollinator1RP, null);
  rp = calculateAllianceRankingPoints({ robots: [a, b], activeRobotCount: 2, eventType: "all_other_events" });
  assert.equal(rp.swarmRP, 1); // 16 combined LEAVE + PARK points
  assert.equal(rp.pollinator1RP, 1); // 4 alliance TIPS split across AUTO and TELEOP
  assert.equal(rp.pollinator2RP, 0); // fewer than 7
  assert.equal(rp.winRP, null);
  assert.equal(rp.status, "partial");
});

test("honors exact 4 and 7 tip thresholds and keeps championship thresholds pending", () => {
  const robots = [emptyRobotScoutingInput(), emptyRobotScoutingInput()];
  robots[0].auto.hiveTips = 4;
  let rp = calculateAllianceRankingPoints({ robots, activeRobotCount: 2, eventType: "all_other_events" });
  assert.equal(rp.pollinator1RP, 1);
  assert.equal(rp.pollinator2RP, 0);
  robots[0].auto.hiveTips = 7;
  rp = calculateAllianceRankingPoints({ robots, activeRobotCount: 2, eventType: "all_other_events" });
  assert.equal(rp.pollinator1RP, 1);
  assert.equal(rp.pollinator2RP, 1);
  const championship = calculateAllianceRankingPoints({ robots, activeRobotCount: 2, eventType: "first_championship" });
  assert.equal(championship.pollinator1RP, null);
  assert.equal(championship.swarmRP, null);
  assert.ok(championship.missing.includes("verified RP thresholds for this event type"));
  assert.notEqual(championship.ruleVersion, RULE_CONFIGURATIONS.all_other_events.version);
});

test("uses verified match results for win, tie and loss only", () => {
  const robots = [emptyRobotScoutingInput(), emptyRobotScoutingInput()];
  const calculate = (ourPoints: number, opponentPoints: number) => calculateAllianceRankingPoints({ robots, activeRobotCount: 2, eventType: "all_other_events", officialResult: { ourPoints, opponentPoints, confirmed: true, source: "FIRST" } });
  assert.equal(calculate(50, 49).winRP, 3);
  assert.equal(calculate(50, 50).winRP, 1);
  assert.equal(calculate(49, 50).winRP, 0);
  assert.equal(calculateEstimateWin().winRP, null);
});

function calculateEstimateWin() {
  return calculateAllianceRankingPoints({ robots: [emptyRobotScoutingInput(), emptyRobotScoutingInput()], activeRobotCount: 2, eventType: "all_other_events" });
}

test("compares estimates to official points without treating a missing result as zero", () => {
  assert.deepEqual(compareEstimateToOfficial(41, null), { difference: null, status: "pending" });
  assert.deepEqual(compareEstimateToOfficial(41, 38), { difference: 3, status: "available" });
  assert.throws(() => compareEstimateToOfficial(-1, 0), RangeError);
});
