import assert from "node:assert/strict";
import test from "node:test";
import { mergeOfficialMatches, normalizeEvents, normalizeHybridSchedule } from "../../lib/first/normalize.ts";
import { defaultTheme, palettes } from "../../lib/theme.ts";

test("renames only Aztech while retaining all six palette definitions and colors", () => {
  assert.equal(palettes.length, 6);
  assert.deepEqual(palettes.map(palette => palette.name), ["Honeycomb", "Violet", "Midnight", "Forest", "Ocean", "Minimal"]);
  assert.deepEqual(palettes[1].colors, { primary: "#7047eb", secondary: "#282044", accent: "#ffb454", background: "#11101a", surface: "#1d1b29", mode: "dark" });
  assert.equal(palettes[0].colors, defaultTheme);
});

test("normalizes official event fields without requiring optional location or date values", () => {
  assert.deepEqual(normalizeEvents({ events: [{ eventId: "id-1", code: "MABOS", name: "Boston Regional", city: "Boston", dateStart: "2027-02-01T00:00:00", dateEnd: null }] }), [{
    id: "id-1", code: "MABOS", name: "Boston Regional", venue: null, address: null, city: "Boston", stateProv: null, country: null,
    dateStart: "2027-02-01T00:00:00", dateEnd: null, type: null,
  }]);
  assert.deepEqual(normalizeEvents({ events: null }), []);
});

test("distinguishes scheduled, pending and zero-point official match results", () => {
  const normalized = normalizeHybridSchedule({ schedule: [
    { matchNumber: 1, tournamentLevel: "qual", startTime: "2027-01-01T10:00:00", teams: [{ station: "Red1", teamNumber: 1 }, { station: "Blue1", teamNumber: 2 }] },
    { matchNumber: 2, actualStartTime: "2027-01-01T11:00:00", teams: [] },
    { matchNumber: 3, scoreRedFinal: 0, scoreBlueFinal: 0, scoreRedAuto: 0, scoreBlueAuto: 0, scoreRedFoul: 0, scoreBlueFoul: 0, teams: [] },
  ] }, 2027, "MABOS", "qual");
  assert.deepEqual(normalized.map(match => match.status), ["scheduled", "result_pending", "played"]);
  assert.equal(normalized[2].redFinal, 0);
  assert.equal(normalized[0].redFinal, null);
  assert.deepEqual(normalized[0].redTeams.map(team => team.number), [1]);
});

test("merges official updates by stable ID and retains fields missing from a later response", () => {
  const [first] = normalizeHybridSchedule({ schedule: [{ matchNumber: 4, scoreRedFinal: 10, scoreBlueFinal: 8, scoreRedAuto: 3, teams: [{ station: "Red1", teamNumber: 101 }] }] }, 2027, "MABOS", "qual");
  const [later] = normalizeHybridSchedule({ schedule: [{ matchNumber: 4, actualStartTime: "2027-02-01T12:00:00", teams: [] }] }, 2027, "MABOS", "qual");
  const updated = mergeOfficialMatches([first], [later]);
  assert.equal(updated.length, 1);
  assert.equal(updated[0].redFinal, 10);
  assert.equal(updated[0].redAuto, 3);
  assert.deepEqual(updated[0].redTeams.map(team => team.number), [101]);
  assert.notEqual(first.id, normalizeHybridSchedule({ schedule: [{ matchNumber: 4 }] }, 2026, "MABOS", "qual")[0].id);
});
