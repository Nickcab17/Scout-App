import type { AppData, Team } from "../types";

export type OfficialTeam = { number: number; name: string };
export type TeamImportPreview = {
  number: number;
  name: string;
  state: "new" | "updated" | "existing";
  existingId?: string;
};

function associationKey(season: number, eventCode: string) {
  return `${season}:${eventCode.toUpperCase()}`;
}

export function normalizeOfficialTeams(payload: unknown): OfficialTeam[] {
  const root = payload && typeof payload === "object" && !Array.isArray(payload) ? payload as { teams?: unknown[] } : {};
  if (!Array.isArray(root.teams)) return [];
  const byNumber = new Map<number, OfficialTeam>();
  for (const raw of root.teams) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const number = Number(row.teamNumber);
    if (!Number.isInteger(number) || number < 1) continue;
    const name = typeof row.nameFull === "string" ? row.nameFull.trim()
      : typeof row.nameShort === "string" ? row.nameShort.trim()
      : typeof row.teamName === "string" ? row.teamName.trim()
      : "";
    byNumber.set(number, { number, name: name || `FTC Team ${number}` });
  }
  return [...byNumber.values()].sort((a, b) => a.number - b.number);
}

export function previewTeamImport(data: AppData, teams: OfficialTeam[], season: number, eventCode: string): TeamImportPreview[] {
  const eventKey = associationKey(season, eventCode);
  return teams.map(team => {
    const existing = data.teams.find(item => item.number === team.number);
    if (!existing) return { number: team.number, name: team.name, state: "new" };
    const hasAssociation = (existing.officialAssociations ?? []).some(item => associationKey(item.season, item.eventCode) === eventKey);
    const needsOfficialName = !existing.officialName || existing.officialName !== team.name;
    return {
      number: team.number,
      name: team.name,
      state: hasAssociation && !needsOfficialName ? "existing" : "updated",
      existingId: existing.id,
    };
  });
}

export function importOfficialTeams(data: AppData, teams: OfficialTeam[], season: number, eventCode: string, selectedNumbers?: number[]): { data: AppData; counts: { newTeams: number; updated: number; existing: number } } {
  const selected = selectedNumbers ? new Set(selectedNumbers) : null;
  const now = new Date().toISOString();
  const nextTeams = [...data.teams];
  let newTeams = 0;
  let updated = 0;
  let existing = 0;

  for (const official of teams) {
    if (selected && !selected.has(official.number)) continue;
    const index = nextTeams.findIndex(team => team.number === official.number);
    const eventAssociation = { season, eventCode: eventCode.toUpperCase() };
    if (index < 0) {
      const team: Team = {
        id: crypto.randomUUID(),
        number: official.number,
        name: official.name,
        capabilities: "",
        autonomous: "",
        mechanical: "",
        notes: "",
        status: "pending",
        createdAt: now,
        updatedAt: now,
        officialName: official.name,
        source: "first_imported",
        officialAssociations: [eventAssociation],
      };
      nextTeams.push(team);
      newTeams++;
      continue;
    }

    const current = nextTeams[index];
    const associations = [...(current.officialAssociations ?? [])];
    if (!associations.some(item => item.season === season && item.eventCode.toUpperCase() === eventAssociation.eventCode)) associations.push(eventAssociation);
    const officialNameChanged = !current.officialName || current.officialName !== official.name;
    const associationChanged = associations.length !== (current.officialAssociations ?? []).length;
    if (!officialNameChanged && !associationChanged) existing++;
    else updated++;

    nextTeams[index] = {
      ...current,
      updatedAt: now,
      officialName: officialNameChanged ? official.name : current.officialName,
      officialAssociations: associations,
      source: current.source === "manual" || !current.source ? "mixed" : "mixed",
    };
  }

  return { data: { ...data, teams: nextTeams }, counts: { newTeams, updated, existing } };
}
