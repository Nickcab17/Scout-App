/**
 * BIOBUZZ scoring estimate based on the official 2026-27 Competition Manual TU06.
 * Results from this module are scouting estimates, never official event scores.
 */
export const BIOBUZZ_RULES = {
  season: "2026-2027",
  manualVersion: "TU06",
  version: "biobuzz-2026-2027-TU06.1",
  source: "https://ftc-resources.firstinspires.org/ftc/game/cm-html/BIOBUZZ%20Competition%20Manual%20-%20TU06.htm",
  points: { leaveAuto: 3, parkAuto: 5, parkTeleop: 5, hiveTip: 20, cellElement: 2, flowerElement: 2, bottomNectarBonus: 5, gardenElement: 1 },
} as const;

export type EventType = "not_configured" | "all_other_events" | "regional_championship" | "first_championship" | "premier_event";
export type RuleConfiguration = {
  version: string;
  eventType: EventType;
  thresholds: { swarmPoints: number | null; pollinator1Tips: number | null; pollinator2Tips: number | null };
};

export const RULE_CONFIGURATIONS: Record<EventType, RuleConfiguration> = {
  not_configured: { version: "2026-2027-TU06-event-type-pending.1", eventType: "not_configured", thresholds: { swarmPoints: null, pollinator1Tips: null, pollinator2Tips: null } },
  all_other_events: { version: "2026-2027-TU06-all-other-events.1", eventType: "all_other_events", thresholds: { swarmPoints: 16, pollinator1Tips: 4, pollinator2Tips: 7 } },
  regional_championship: { version: "2026-2027-TU06-regional-pending.1", eventType: "regional_championship", thresholds: { swarmPoints: null, pollinator1Tips: null, pollinator2Tips: null } },
  first_championship: { version: "2026-2027-TU06-first-pending.1", eventType: "first_championship", thresholds: { swarmPoints: null, pollinator1Tips: null, pollinator2Tips: null } },
  premier_event: { version: "2026-2027-TU06-premier-pending.1", eventType: "premier_event", thresholds: { swarmPoints: null, pollinator1Tips: null, pollinator2Tips: null } },
};

export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && Object.hasOwn(RULE_CONFIGURATIONS, value);
}

export type PieceCounts = { pollen: number; nectar: number };
export type RobotScoutingInput = {
  auto: { leave: boolean; park: boolean; hiveTips: number };
  teleop: { park: boolean; hiveTips: number; cells: PieceCounts; flowers: PieceCounts; bottomNectarBonusFlowers: number; gardens: PieceCounts };
};

export type ScoreBreakdown = {
  autoPoints: number;
  teleopPoints: number;
  totalMatchPoints: number;
  totalTips: number;
  cellPoints: number;
  flowerPoints: number;
  gardenPoints: number;
  bonusPoints: number;
  penaltyPoints: number | null;
  estimated: true;
  ruleVersion: string;
  poolPoints: null;
};

export type OfficialResult = { ourPoints: number; opponentPoints: number; confirmed: true; source: "FIRST" | "referee" };
export type AllianceRankingInput = {
  robots: RobotScoutingInput[];
  activeRobotCount: 2 | 3;
  eventType: EventType;
  officialResult?: OfficialResult;
};
export type RankingPointBreakdown = {
  swarmRP: number | null;
  pollinator1RP: number | null;
  pollinator2RP: number | null;
  winRP: number | null;
  totalEstimatedRP: number;
  status: "complete" | "partial" | "pending";
  missing: string[];
  ruleVersion: string;
};

export const emptyRobotScoutingInput = (): RobotScoutingInput => ({
  auto: { leave: false, park: false, hiveTips: 0 },
  teleop: { park: false, hiveTips: 0, cells: { pollen: 0, nectar: 0 }, flowers: { pollen: 0, nectar: 0 }, bottomNectarBonusFlowers: 0, gardens: { pollen: 0, nectar: 0 } },
});

function count(value: number, name: string, max?: number): number {
  if (!Number.isInteger(value) || value < 0 || (max !== undefined && value > max)) throw new RangeError(`${name} must be a whole number between 0 and ${max ?? "infinity"}.`);
  return value;
}

function validateInput(input: RobotScoutingInput): void {
  if (typeof input.auto.leave !== "boolean" || typeof input.auto.park !== "boolean" || typeof input.teleop.park !== "boolean") throw new TypeError("Leave and Park values must be confirmed booleans.");
  count(input.auto.hiveTips, "AUTO tips");
  count(input.teleop.hiveTips, "TELEOP tips");
  for (const [name, pieces] of [["CELL", input.teleop.cells], ["FLOWER", input.teleop.flowers], ["GARDEN", input.teleop.gardens]] as const) {
    count(pieces.pollen, `${name} pollen`);
    count(pieces.nectar, `${name} nectar`);
  }
  count(input.teleop.bottomNectarBonusFlowers, "Bottom Nectar alliance bonus", 1);
}

export function calculateRobotScore(input: RobotScoutingInput): ScoreBreakdown {
  validateInput(input);
  const p = BIOBUZZ_RULES.points;
  const totalTips = input.auto.hiveTips + input.teleop.hiveTips;
  const autoPoints = (input.auto.leave ? p.leaveAuto : 0) + (input.auto.park ? p.parkAuto : 0) + input.auto.hiveTips * p.hiveTip;
  const cellPoints = (input.teleop.cells.pollen + input.teleop.cells.nectar) * p.cellElement;
  const flowerPoints = (input.teleop.flowers.pollen + input.teleop.flowers.nectar) * p.flowerElement;
  const gardenPoints = (input.teleop.gardens.pollen + input.teleop.gardens.nectar) * p.gardenElement;
  const bonusPoints = input.teleop.bottomNectarBonusFlowers * p.bottomNectarBonus;
  const teleopPoints = (input.teleop.park ? p.parkTeleop : 0) + input.teleop.hiveTips * p.hiveTip + cellPoints + flowerPoints + gardenPoints + bonusPoints;
  return { autoPoints, teleopPoints, totalMatchPoints: autoPoints + teleopPoints, totalTips, cellPoints, flowerPoints, gardenPoints, bonusPoints, penaltyPoints: null, estimated: true, ruleVersion: BIOBUZZ_RULES.version, poolPoints: null };
}

export function calculateAllianceRankingPoints(input: AllianceRankingInput): RankingPointBreakdown {
  const rules = RULE_CONFIGURATIONS[input.eventType];
  if (!rules) throw new TypeError("Unknown event type.");
  const missing: string[] = [];
  if (input.robots.length < input.activeRobotCount) missing.push(`${input.activeRobotCount - input.robots.length} active robot scouting record(s)`);
  const isComplete = input.robots.length === input.activeRobotCount;
  const scores = input.robots.map(calculateRobotScore);
  const combinedLeavePark = input.robots.reduce((sum, robot) => sum + (robot.auto.leave ? BIOBUZZ_RULES.points.leaveAuto : 0) + (robot.auto.park ? BIOBUZZ_RULES.points.parkAuto : 0) + (robot.teleop.park ? BIOBUZZ_RULES.points.parkTeleop : 0), 0);
  const totalTips = scores.reduce((sum, score) => sum + score.totalTips, 0);
  const swarmRP = rules.thresholds.swarmPoints === null ? null : isComplete ? Number(combinedLeavePark >= rules.thresholds.swarmPoints) : null;
  const pollinator1RP = rules.thresholds.pollinator1Tips === null ? null : isComplete ? Number(totalTips >= rules.thresholds.pollinator1Tips) : null;
  const pollinator2RP = rules.thresholds.pollinator2Tips === null ? null : isComplete ? Number(totalTips >= rules.thresholds.pollinator2Tips) : null;
  if (!isComplete) missing.push("complete active alliance scouting for alliance RP");
  if ([swarmRP, pollinator1RP, pollinator2RP].some(value => value === null)) missing.push("verified RP thresholds for this event type");
  let winRP: number | null = null;
  if (input.officialResult?.confirmed) {
    count(input.officialResult.ourPoints, "Official alliance points");
    count(input.officialResult.opponentPoints, "Official opponent points");
    winRP = input.officialResult.ourPoints > input.officialResult.opponentPoints ? 3 : input.officialResult.ourPoints === input.officialResult.opponentPoints ? 1 : 0;
  } else missing.push("verified official/referee match result for win RP");
  const values = [swarmRP, pollinator1RP, pollinator2RP, winRP];
  const totalEstimatedRP = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  const status = values.every(value => value !== null) ? "complete" : values.every(value => value === null) ? "pending" : "partial";
  return { swarmRP, pollinator1RP, pollinator2RP, winRP, totalEstimatedRP, status, missing, ruleVersion: rules.version };
}

export function compareEstimateToOfficial(estimatedPoints: number, officialPoints: number | null) {
  if (!Number.isFinite(estimatedPoints) || estimatedPoints < 0) throw new RangeError("Estimated points must be non-negative.");
  if (officialPoints === null) return { difference: null, status: "pending" as const };
  count(officialPoints, "Official points");
  return { difference: estimatedPoints - officialPoints, status: "available" as const };
}

export function estimateScore(): null { return null; }
