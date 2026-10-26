export type Team = { id: string; number: number; name: string; capabilities: string; autonomous: string; mechanical: string; notes: string; status: "pending" | "observed" | "verified"; createdAt: string };
export type Match = { id: string; number: number; event: string; teams: [string, string, string, string]; createdAt: string };
export type Observation = { id: string; matchId: string; teamNumber: number; status: "draft" | "submitted"; auto: string; teleop: string; hiveTip: string; pollen: string; nectar: string; flowerGarden: string; leavePark: string; issues: string; notes: string; updatedAt: string };
export type AppData = { teams: Team[]; matches: Match[]; observations: Observation[] };
export const emptyData: AppData = { teams: [], matches: [], observations: [] };
