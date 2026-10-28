export type OfficialEvent = {
  id: string;
  code: string;
  name: string;
  venue: string | null;
  address: string | null;
  city: string | null;
  stateProv: string | null;
  country: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  type: string | null;
};

export type OfficialMatch = {
  id: string;
  level: "qual" | "playoff";
  series: number | null;
  number: number;
  description: string | null;
  startTime: string | null;
  actualStartTime: string | null;
  postResultTime: string | null;
  redTeams: { number: number; name: string | null }[];
  blueTeams: { number: number; name: string | null }[];
  redFinal: number | null;
  redAuto: number | null;
  redFoul: number | null;
  redDriveControlled: number | null;
  redEndgame: number | null;
  blueFinal: number | null;
  blueAuto: number | null;
  blueFoul: number | null;
  blueDriveControlled: number | null;
  blueEndgame: number | null;
  status: "scheduled" | "result_pending" | "played";
};

type Row = Record<string, unknown>;
const obj = (value: unknown): Row => value !== null && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const str = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
const num = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

export function normalizeEvents(payload: unknown): OfficialEvent[] {
  const rows = obj(payload).events;
  if (!Array.isArray(rows)) return [];
  return rows.map((raw, index) => {
    const row = obj(raw);
    return {
      id: str(row.eventId) ?? `${str(row.code) ?? "unknown"}:${index}`,
      code: str(row.code) ?? "",
      name: str(row.name) ?? "Evento sin nombre publicado",
      venue: str(row.venue), address: str(row.address), city: str(row.city), stateProv: str(row.stateprov),
      country: str(row.country), dateStart: str(row.dateStart), dateEnd: str(row.dateEnd), type: str(row.typeName) ?? str(row.type),
    };
  }).filter(event => event.code.length > 0);
}

export function normalizeHybridSchedule(payload: unknown, season: number, eventCode: string, level: "qual" | "playoff"): OfficialMatch[] {
  const rows = obj(payload).schedule;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap(raw => {
    const row = obj(raw);
    const number = num(row.matchNumber);
    if (number === null) return [];
    const teams = Array.isArray(row.teams) ? row.teams.map(obj) : [];
    const allianceTeams = (alliance: "red" | "blue") => teams.flatMap(team => {
      const station = str(team.station)?.toLowerCase() ?? "";
      const teamNumber = num(team.teamNumber);
      if (!station.startsWith(alliance) || teamNumber === null) return [];
      return [{ number: teamNumber, name: str(team.teamName) ?? str(team.team) }];
    });
    const redFinal = num(row.scoreRedFinal);
    const blueFinal = num(row.scoreBlueFinal);
    const actualStartTime = str(row.actualStartTime);
    const status = redFinal !== null && blueFinal !== null ? "played" : actualStartTime ? "result_pending" : "scheduled";
    const series = num(row.series);
    return [{
      id: `${season}:${eventCode.toUpperCase()}:${level}:${series ?? 0}:${number}`,
      level, series, number, description: str(row.description), startTime: str(row.startTime), actualStartTime,
      postResultTime: str(row.postResultTime), redTeams: allianceTeams("red"), blueTeams: allianceTeams("blue"),
      redFinal, redAuto: num(row.scoreRedAuto), redFoul: num(row.scoreRedFoul), redDriveControlled: num(row.scoreRedDriveControlled), redEndgame: num(row.scoreRedEndgame),
      blueFinal, blueAuto: num(row.scoreBlueAuto), blueFoul: num(row.scoreBlueFoul), blueDriveControlled: num(row.scoreBlueDriveControlled), blueEndgame: num(row.scoreBlueEndgame), status,
    } satisfies OfficialMatch];
  });
}

export function mergeOfficialMatches(previous: OfficialMatch[], updated: OfficialMatch[]): OfficialMatch[] {
  const oldById = new Map(previous.map(match => [match.id, match]));
  for (const match of updated) {
    const old = oldById.get(match.id);
    if (!old) { oldById.set(match.id, match); continue; }
    oldById.set(match.id, {
      ...old, ...match,
      description: match.description ?? old.description, startTime: match.startTime ?? old.startTime,
      actualStartTime: match.actualStartTime ?? old.actualStartTime, postResultTime: match.postResultTime ?? old.postResultTime,
      redTeams: match.redTeams.length ? match.redTeams : old.redTeams, blueTeams: match.blueTeams.length ? match.blueTeams : old.blueTeams,
      redFinal: match.redFinal ?? old.redFinal, redAuto: match.redAuto ?? old.redAuto, redFoul: match.redFoul ?? old.redFoul,
      redDriveControlled: match.redDriveControlled ?? old.redDriveControlled, redEndgame: match.redEndgame ?? old.redEndgame,
      blueFinal: match.blueFinal ?? old.blueFinal, blueAuto: match.blueAuto ?? old.blueAuto, blueFoul: match.blueFoul ?? old.blueFoul,
      blueDriveControlled: match.blueDriveControlled ?? old.blueDriveControlled, blueEndgame: match.blueEndgame ?? old.blueEndgame,
      status: match.redFinal !== null && match.blueFinal !== null ? "played" : old.status,
    });
  }
  return [...oldById.values()].sort((a,b)=>a.level.localeCompare(b.level)||((a.series??0)-(b.series??0))||a.number-b.number);
}
