export type PitDataSource = "team_reported" | "scout_observed" | "unknown";
export type TeamImportAssociation = { season: number; eventCode: string };
export type Team = { id: string; number: number; name: string; capabilities: string; autonomous: string; mechanical: string; notes: string; capabilitiesSource?: PitDataSource; autonomousSource?: PitDataSource; mechanicalSource?: PitDataSource; status: "pending" | "observed" | "verified"; createdAt: string; updatedAt?: string; officialName?: string; source?: "manual" | "first_imported" | "mixed"; officialAssociations?: TeamImportAssociation[] };
import type { EventType, RobotScoutingInput } from "./scoring";
export type Match = { id: string; number: number; event: string; eventType?: EventType; teams: [string, string, string, string]; createdAt: string; season?: number; eventCode?: string; tournamentLevel?: "qual" | "playoff"; officialMatchId?: string };
export type ObservationAlliance = "red" | "blue";
export type FlowerObservation = { pollen: number; nectar: number };
export type PieceCounts = { pollen: number; nectar: number };
export type MatchActions = {
  auto: {
    leave: boolean;
    park: boolean;
    hiveTips: number;
    pollenLaunchedCell: number;
    nectarLaunchedCell: number;
  };
  teleop: {
    hiveTips: number;
    pollenLaunchedCell: number;
    nectarLaunchedCell: number;
    pollenFromFlowers: number;
    nectarFromFlowers: number;
    flowers: [FlowerObservation, FlowerObservation, FlowerObservation, FlowerObservation];
    gardens: PieceCounts;
  };
  endGame: {
    park: boolean;
    hiveTips: number;
    flowers: [FlowerObservation, FlowerObservation, FlowerObservation, FlowerObservation];
    cells: PieceCounts;
    gardens: PieceCounts;
    flowersFinal: [FlowerObservation, FlowerObservation, FlowerObservation, FlowerObservation];
  };
};
export type AllianceFinalState = {
  cells: PieceCounts;
  gardens: PieceCounts;
  flowersFinal: [FlowerObservation, FlowerObservation, FlowerObservation, FlowerObservation];
  flowerOwners: ["red" | "blue" | null, "red" | "blue" | null, "red" | "blue" | null, "red" | "blue" | null];
  bottomNectarBonusFlowers: number;
};
export type OfficialMatchResult = { redScore: number | null; blueScore: number | null; source: "FIRST"; confirmed: boolean };
export type Observation = { id: string; matchId: string; teamNumber: number; status: "draft" | "submitted"; auto: string; teleop: string; hiveTip: string; pollen: string; nectar: string; flowerGarden: string; leavePark: string; issues: string; notes: string; updatedAt: string; capturedAt?: string; scoutName?: string; scoring?: RobotScoutingInput; scoringConfirmed?: boolean; pollenCount?: number; alliance?: ObservationAlliance; season?: number; eventCode?: string; tournamentLevel?: "qual" | "playoff"; officialMatchId?: string; actions?: MatchActions; allianceFinal?: AllianceFinalState; officialResult?: OfficialMatchResult };
export type AppData = { teams: Team[]; matches: Match[]; observations: Observation[] };
export const emptyData: AppData = { teams: [], matches: [], observations: [] };
