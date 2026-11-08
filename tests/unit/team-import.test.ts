import assert from "node:assert/strict";
import test from "node:test";
import { importOfficialTeams, normalizeOfficialTeams, previewTeamImport } from "../../lib/first/team-import.ts";
import type { AppData, Team } from "../../lib/types.ts";

const manualTeam: Team = {
  id: "manual-101",
  number: 101,
  name: "Nombre local",
  capabilities: "Pit conservado",
  autonomous: "AUTO conservado",
  mechanical: "Mecanismo conservado",
  notes: "Notas locales",
  status: "verified",
  createdAt: "2026-01-01",
};

test("previews and imports multiple official teams without number duplicates", () => {
  const data: AppData = { teams: [manualTeam], matches: [], observations: [] };
  const payload = {
    teams: [
      { teamNumber: 101, nameFull: "Nombre FIRST actualizado" },
      { teamNumber: 202, nameFull: "Equipo FIRST 202" },
    ],
  };
  const official = normalizeOfficialTeams(payload);
  const preview = previewTeamImport(data, official, 2026, "AUBRQ1");
  assert.deepEqual(preview.map(item => item.state), ["updated", "new"]);

  const result = importOfficialTeams(data, official, 2026, "AUBRQ1", [101, 202]);
  assert.equal(result.data.teams.length, 2);
  assert.deepEqual(result.counts, { newTeams: 1, updated: 1, existing: 0 });
  const existing = result.data.teams.find(team => team.number === 101)!;
  assert.equal(existing.name, "Nombre local");
  assert.equal(existing.capabilities, "Pit conservado");
  assert.equal(existing.autonomous, "AUTO conservado");
  assert.equal(existing.notes, "Notas locales");
  assert.equal(existing.officialName, "Nombre FIRST actualizado");
  assert.equal(existing.officialAssociations?.[0].eventCode, "AUBRQ1");
});

test("repeated imports do not duplicate teams and preserve completed scouting data", () => {
  const first = importOfficialTeams({ teams: [], matches: [], observations: [] }, normalizeOfficialTeams({
    teams: [{ teamNumber: 303, nameFull: "Equipo 303" }],
  }), 2026, "USALATQ");
  const repeated = importOfficialTeams(first.data, normalizeOfficialTeams({
    teams: [{ teamNumber: 303, nameFull: "Equipo 303" }],
  }), 2026, "USALATQ");
  assert.equal(repeated.data.teams.length, 1);
  assert.equal(repeated.counts.existing, 1);
  assert.equal(repeated.counts.newTeams, 0);
  assert.equal(repeated.data.matches.length, 0);
  assert.equal(repeated.data.observations.length, 0);
});
