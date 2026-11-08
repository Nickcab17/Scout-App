import type { AppData, Match, Observation, Team } from "./types.ts";
import { calculateRobotScore, type ScoreBreakdown } from "./scoring.ts";

export type AnalyticsFilters = {
  season: string;
  event: string;
  team: string;
  period: "all" | "5" | "10";
};

export type ConfirmedRecord = {
  observation: Observation;
  match: Match | undefined;
  score: ScoreBreakdown;
};

export type TeamStats = {
  team: Team;
  records: ConfirmedRecord[];
  incomplete: number;
  matches: number;
  average: number;
  median: number;
  minimum: number;
  maximum: number;
  standardDeviation: number;
  consistency: number;
  autoAverage: number;
  teleopAverage: number;
  recentAverage: number;
  categoryAverage: { auto: number; teleop: number; cell: number; flower: number; garden: number; bonus: number };
};

export const defaultAnalyticsFilters: AnalyticsFilters = { season: "all", event: "all", team: "all", period: "all" };

function median(values: number[]): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function standardDeviation(values: number[], average: number): number {
  if (!values.length) return 0;
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length);
}

function matchSeason(match: Match | undefined, observation: Observation): string {
  if (match?.season) return String(match.season);
  const matchEvent = observation.auto.match(/temporada\s+(\d{4})/i)?.[1];
  return matchEvent || "Sin temporada";
}

function matchEvent(match: Match | undefined): string {
  return match?.event || match?.eventCode || "Evento local";
}

export function filterConfirmedRecords(data: AppData, filters: Partial<AnalyticsFilters> = {}): ConfirmedRecord[] {
  const active = { ...defaultAnalyticsFilters, ...filters };
  const records = data.observations.flatMap(observation => {
    if (!observation.scoringConfirmed || !observation.scoring) return [];
    const match = data.matches.find(item => item.id === observation.matchId);
    if (active.team !== "all" && String(observation.teamNumber) !== active.team) return [];
    if (active.season !== "all" && matchSeason(match, observation) !== active.season) return [];
    if (active.event !== "all" && matchEvent(match) !== active.event) return [];
    return [{ observation, match, score: calculateRobotScore(observation.scoring) }];
  });
  records.sort((a, b) => (a.match?.number || 0) - (b.match?.number || 0));
  if (active.period !== "all") return records.slice(-Number(active.period));
  return records;
}

export function countIncompleteRecords(data: AppData, filters: Partial<AnalyticsFilters> = {}): number {
  const active = { ...defaultAnalyticsFilters, ...filters };
  return data.observations.filter(observation => {
    const match = data.matches.find(item => item.id === observation.matchId);
    if (active.team !== "all" && String(observation.teamNumber) !== active.team) return false;
    if (active.season !== "all" && matchSeason(match, observation) !== active.season) return false;
    if (active.event !== "all" && matchEvent(match) !== active.event) return false;
    return !observation.scoringConfirmed || !observation.scoring;
  }).length;
}

export function getTeamStats(data: AppData, filters: Partial<AnalyticsFilters> = {}): TeamStats[] {
  const records = filterConfirmedRecords(data, filters);
  const active = { ...defaultAnalyticsFilters, ...filters };
  return data.teams.filter(team => {
    if (active.team !== "all" && String(team.number) !== active.team) return false;
    if (active.event === "all") return true;
    const associated = (team.officialAssociations ?? []).some(item =>
      item.eventCode.toUpperCase() === String(active.event).toUpperCase() &&
      (active.season === "all" || `${item.season}` === active.season)
    );
    const matchedByRecord = records.some(record => record.observation.teamNumber === team.number);
    const matchedByMatch = data.matches.some(match =>
      match.teams.includes(String(team.number)) &&
      (matchEvent(match) === active.event || match.eventCode?.toUpperCase() === String(active.event).toUpperCase())
    );
    return associated || matchedByRecord || matchedByMatch;
  }).map(team => {
    const teamRecords = records.filter(record => record.observation.teamNumber === team.number);
    const values = teamRecords.map(record => record.score.totalMatchPoints);
    const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
    const deviation = standardDeviation(values, average);
    const recent = [...teamRecords].sort((a, b) => (b.match?.createdAt || "").localeCompare(a.match?.createdAt || "")).slice(0, 3);
    const recentAverage = recent.length ? recent.reduce((sum, record) => sum + record.score.totalMatchPoints, 0) / recent.length : 0;
    const categoryAverage = teamRecords.length ? {
      auto: teamRecords.reduce((sum, record) => sum + record.score.autoPoints, 0) / teamRecords.length,
      teleop: teamRecords.reduce((sum, record) => sum + record.score.teleopPoints, 0) / teamRecords.length,
      cell: teamRecords.reduce((sum, record) => sum + record.score.cellPoints, 0) / teamRecords.length,
      flower: teamRecords.reduce((sum, record) => sum + record.score.flowerPoints, 0) / teamRecords.length,
      garden: teamRecords.reduce((sum, record) => sum + record.score.gardenPoints, 0) / teamRecords.length,
      bonus: teamRecords.reduce((sum, record) => sum + record.score.bonusPoints, 0) / teamRecords.length,
    } : { auto: 0, teleop: 0, cell: 0, flower: 0, garden: 0, bonus: 0 };
    return {
      team,
      records: teamRecords,
      incomplete: countIncompleteRecords(data, { ...filters, team: String(team.number) }),
      matches: new Set(teamRecords.map(record => record.observation.matchId)).size,
      average,
      median: median(values),
      minimum: values.length ? Math.min(...values) : 0,
      maximum: values.length ? Math.max(...values) : 0,
      standardDeviation: deviation,
      consistency: average > 0 ? Math.max(0, Math.min(100, 100 * (1 - deviation / average))) : 0,
      autoAverage: teamRecords.length ? teamRecords.reduce((sum, record) => sum + record.score.autoPoints, 0) / teamRecords.length : 0,
      teleopAverage: teamRecords.length ? teamRecords.reduce((sum, record) => sum + record.score.teleopPoints, 0) / teamRecords.length : 0,
      recentAverage,
      categoryAverage,
    };
  });
}

export type RankingWeights = { total: number; auto: number; teleop: number; consistency: number; recent: number };
export const defaultRankingWeights: RankingWeights = { total: 40, auto: 15, teleop: 25, consistency: 10, recent: 10 };

export function normalize(value: number, maximum: number): number {
  return maximum > 0 ? Math.max(0, Math.min(100, value / maximum * 100)) : 0;
}

export function rankTeamStats(stats: TeamStats[], weights: RankingWeights = defaultRankingWeights) {
  stats = stats.filter(item => item.records.length > 0);
  const totalMax = Math.max(...stats.map(item => item.average), 1);
  const autoMax = Math.max(...stats.map(item => item.autoAverage), 1);
  const teleopMax = Math.max(...stats.map(item => item.teleopAverage), 1);
  const recentMax = Math.max(...stats.map(item => item.recentAverage), 1);
  const weightTotal = Object.values(weights).reduce((sum, value) => sum + value, 0) || 1;
  return stats.map(item => {
    const total = normalize(item.average, totalMax) * weights.total;
    const auto = normalize(item.autoAverage, autoMax) * weights.auto;
    const teleop = normalize(item.teleopAverage, teleopMax) * weights.teleop;
    const consistency = item.consistency * weights.consistency;
    const recent = normalize(item.recentAverage, recentMax) * weights.recent;
    return { ...item, rankingScore: (total + auto + teleop + consistency + recent) / weightTotal };
  }).sort((a, b) => b.rankingScore - a.rankingScore);
}

export function buildAllianceCompatibility(stats: TeamStats[]) {
  return stats.map(item => {
    const strengths: string[] = [];
    const limitations: string[] = [];
    if (item.autoAverage > 0) strengths.push("Rendimiento autónomo registrado");
    if (item.teleopAverage > 0) strengths.push("Aporte TeleOp registrado");
    if (item.consistency >= 70) strengths.push("Consistencia alta");
    if (item.categoryAverage.flower > item.categoryAverage.cell) strengths.push("Potencial FLOWER");
    if (item.categoryAverage.garden > item.categoryAverage.cell) strengths.push("Potencial GARDEN");
    if (item.records.length < 3) limitations.push("Menos de 3 muestras confirmadas");
    if (item.consistency < 60 && item.records.length > 0) limitations.push("Consistencia variable");
    if (!item.records.length) limitations.push("Sin scoring confirmado");
    return { team: item.team, stats: item, strengths, limitations, reproducibleScore: item.average };
  });
}
