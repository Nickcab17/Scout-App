export type PitDataSource = "team_reported" | "scout_observed" | "unknown";
export type Team = { id: string; number: number; name: string; capabilities: string; autonomous: string; mechanical: string; notes: string; capabilitiesSource?: PitDataSource; autonomousSource?: PitDataSource; mechanicalSource?: PitDataSource; status: "pending" | "observed" | "verified"; createdAt: string; updatedAt?: string };
import type { EventType, RobotScoutingInput } from "./scoring";
export type Match = { id: string; number: number; event: string; eventType?: EventType; teams: [string, string, string, string]; createdAt: string; season?: number; eventCode?: string; tournamentLevel?: "qual" | "playoff"; officialMatchId?: string };
export type Observation = { id: string; matchId: string; teamNumber: number; status: "draft" | "submitted"; auto: string; teleop: string; hiveTip: string; pollen: string; nectar: string; flowerGarden: string; leavePark: string; issues: string; notes: string; updatedAt: string; scoutName?: string; scoring?: RobotScoutingInput; scoringConfirmed?: boolean };
export type AppData = { teams: Team[]; matches: Match[]; observations: Observation[] };
export const emptyData: AppData = { teams: [], matches: [], observations: [] };
