import type { AppData, Match, Observation, Team } from "./types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export function validateImportData(value: unknown): AppData {
  if (!isRecord(value)) throw new Error("El archivo debe contener un objeto JSON.");
  for (const key of ["teams", "matches", "observations"] as const) {
    if (!Array.isArray(value[key])) throw new Error(`Falta una lista válida: ${key}.`);
  }

  const teams: Team[] = (value.teams as unknown[]).map((raw, index) => {
    if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id.trim() ||
      !Number.isInteger(raw.number) || Number(raw.number) < 1 ||
      typeof raw.name !== "string" || !raw.name.trim()) {
      throw new Error(`El equipo ${index + 1} tiene campos inválidos.`);
    }
    for (const field of ["capabilities", "autonomous", "mechanical", "notes"]) {
      if (raw[field] !== undefined && typeof raw[field] !== "string") throw new Error(`El equipo ${index + 1} tiene notas inválidas.`);
    }
    if (raw.status !== undefined && !["pending", "observed", "verified"].includes(String(raw.status))) {
      throw new Error(`El equipo ${index + 1} tiene un estado inválido.`);
    }
    return {
      id: raw.id, number: Number(raw.number), name: raw.name.trim(),
      capabilities: String(raw.capabilities ?? ""), autonomous: String(raw.autonomous ?? ""),
      mechanical: String(raw.mechanical ?? ""), notes: String(raw.notes ?? ""),
      status: (raw.status ?? "pending") as Team["status"],
      createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date(0).toISOString(),
    };
  });
  if (new Set(teams.map(team => team.number)).size !== teams.length || new Set(teams.map(team => team.id)).size !== teams.length) {
    throw new Error("La importación contiene equipos duplicados.");
  }
  const teamNumbers = new Set(teams.map(team => String(team.number)));

  const matches: Match[] = (value.matches as unknown[]).map((raw, index) => {
    if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id.trim() ||
      !Number.isInteger(raw.number) || Number(raw.number) < 1 ||
      typeof raw.event !== "string" || !raw.event.trim() || !Array.isArray(raw.teams) ||
      raw.teams.length !== 4 || raw.teams.some(team => typeof team !== "string" || !teamNumbers.has(team)) ||
      new Set(raw.teams).size !== 4) {
      throw new Error(`El partido ${index + 1} tiene datos inválidos o equipos sin registrar.`);
    }
    return { id: raw.id, number: Number(raw.number), event: raw.event.trim(), teams: raw.teams as Match["teams"], createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date(0).toISOString() };
  });
  if (new Set(matches.map(match => match.id)).size !== matches.length ||
    new Set(matches.map(match => `${match.event.toLocaleLowerCase()}::${match.number}`)).size !== matches.length) {
    throw new Error("La importación contiene partidos duplicados.");
  }
  const matchesById = new Map(matches.map(match => [match.id, match]));

  const observations: Observation[] = (value.observations as unknown[]).map((raw, index) => {
    if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id.trim() ||
      typeof raw.matchId !== "string" || !Number.isInteger(raw.teamNumber) || Number(raw.teamNumber) < 1 ||
      !["draft", "submitted"].includes(String(raw.status))) {
      throw new Error(`La observación ${index + 1} tiene campos inválidos.`);
    }
    const match = matchesById.get(raw.matchId);
    if (!match || !match.teams.includes(String(raw.teamNumber))) throw new Error(`La observación ${index + 1} no corresponde a un equipo de su partido.`);
    for (const field of ["auto", "teleop", "hiveTip", "pollen", "nectar", "flowerGarden", "leavePark", "issues", "notes"]) {
      if (raw[field] !== undefined && typeof raw[field] !== "string") throw new Error(`La observación ${index + 1} tiene campos de texto inválidos.`);
    }
    return {
      id: raw.id, matchId: raw.matchId, teamNumber: Number(raw.teamNumber), status: raw.status as Observation["status"],
      auto: String(raw.auto ?? ""), teleop: String(raw.teleop ?? ""), hiveTip: String(raw.hiveTip ?? ""),
      pollen: String(raw.pollen ?? ""), nectar: String(raw.nectar ?? ""), flowerGarden: String(raw.flowerGarden ?? ""),
      leavePark: String(raw.leavePark ?? ""), issues: String(raw.issues ?? ""), notes: String(raw.notes ?? ""),
      updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date(0).toISOString(),
    };
  });
  if (new Set(observations.map(item => item.id)).size !== observations.length ||
    new Set(observations.map(item => `${item.matchId}::${item.teamNumber}`)).size !== observations.length) {
    throw new Error("La importación contiene observaciones duplicadas.");
  }
  return { teams, matches, observations };
}

export function findImportConflict(current: AppData, incoming: AppData): string | null {
  if (incoming.teams.some(team => current.teams.some(old => old.number === team.number))) return "Ya existe un número de equipo importado en este espacio.";
  if (incoming.matches.some(match => current.matches.some(old => old.id === match.id || (old.number === match.number && old.event.trim().toLocaleLowerCase() === match.event.trim().toLocaleLowerCase())))) return "Ya existe un partido importado con ese evento y número.";
  if (incoming.observations.some(item => current.observations.some(old => old.id === item.id || (old.matchId === item.matchId && old.teamNumber === item.teamNumber)))) return "La importación contiene observaciones que ya están guardadas.";
  return null;
}
