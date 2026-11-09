import type { Match, Observation } from "../types";

export type FirstRobotMatch = {
  id: string;
  season: number;
  eventCode: string;
  level: "qual" | "playoff";
  number: number;
  description: string | null;
  redTeams: { number: number; name: string | null }[];
  blueTeams: { number: number; name: string | null }[];
};

export function parsePollenCount(value: string): number | null {
  if (!/^\d+$/.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function findRobotAlliance(match: FirstRobotMatch, teamNumber: number): "red" | "blue" | null {
  if (match.redTeams.some(team => team.number === teamNumber)) return "red";
  if (match.blueTeams.some(team => team.number === teamNumber)) return "blue";
  return null;
}

export function buildFirstMatchAndObservation(match: FirstRobotMatch, teamNumber: number, pollenCount: number, current: { matches: Match[]; observations: Observation[] }) {
  if (!Number.isSafeInteger(pollenCount) || pollenCount < 0) throw new RangeError("El polen debe ser un entero mayor o igual que cero.");
  const alliance = findRobotAlliance(match, teamNumber);
  if (!alliance) throw new Error("FIRST no proporcionó este robot en las alianzas del partido.");
  const existingMatch = current.matches.find(item => item.officialMatchId === match.id);
  const localMatch: Match = existingMatch ? {
    ...existingMatch,
    number: match.number,
    event: match.eventCode,
    teams: [
      String(match.redTeams[0]?.number ?? ""),
      String(match.redTeams[1]?.number ?? ""),
      String(match.blueTeams[0]?.number ?? ""),
      String(match.blueTeams[1]?.number ?? ""),
    ],
    season: match.season,
    eventCode: match.eventCode,
    tournamentLevel: match.level,
    officialMatchId: match.id,
  } : {
    id: crypto.randomUUID(),
    number: match.number,
    event: match.eventCode,
    createdAt: new Date().toISOString(),
    teams: [
      String(match.redTeams[0]?.number ?? ""),
      String(match.redTeams[1]?.number ?? ""),
      String(match.blueTeams[0]?.number ?? ""),
      String(match.blueTeams[1]?.number ?? ""),
    ],
    season: match.season,
    eventCode: match.eventCode,
    tournamentLevel: match.level,
    officialMatchId: match.id,
  };
  const observation: Observation = {
    id: crypto.randomUUID(),
    matchId: localMatch.id,
    teamNumber,
    status: "submitted",
    auto: "",
    teleop: "",
    hiveTip: "",
    pollen: String(pollenCount),
    nectar: "",
    flowerGarden: "",
    leavePark: "",
    issues: "",
    notes: "",
    updatedAt: new Date().toISOString(),
    pollenCount,
    alliance,
    season: match.season,
    eventCode: match.eventCode,
    tournamentLevel: match.level,
    officialMatchId: match.id,
  };
  return { localMatch, observation };
}
