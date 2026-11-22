import assert from "node:assert/strict";
import test from "node:test";
import { mergeOfficialMatches, normalizeEvents, normalizeHybridSchedule } from "../../lib/first/normalize.ts";
import { getAllFirstEventPages } from "../../lib/first/event-pagination.ts";
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

test("filters mixed FIRST event responses to the requested 2026 season", () => {
  const events = normalizeEvents({ events: [
    { eventId: "evt-2026", code: "MABOS", name: "2026 Regional", season: 2026 },
    { eventId: "evt-2025", code: "OLD25", name: "2025 Regional", season: 2025 },
  ] }, 2026);
  assert.deepEqual(events.map(event => event.code), ["MABOS"]);
});

test("collects every FIRST event page without excluding countries or event types", async () => {
  const pages = [
    { pageTotal: 3, events: [{ eventId: "mx-1", code: "MEX01", country: "Mexico", typeName: "Regional Championship" }, { eventId: "us-1", code: "USA01", country: "USA", typeName: "Qualifier" }] },
    { pageTotal: 3, events: [{ eventId: "ca-1", code: "CAN01", country: "Canada", typeName: "Regional Championship" }] },
    { pageTotal: 3, events: [{ eventId: "mx-1", code: "MEX01", country: "Mexico", typeName: "Regional Championship" }, { eventId: "br-1", code: "BRA01", country: "Brazil", typeName: "League Tournament" }] },
  ];
  const requestedPages: number[] = [];
  const result = await getAllFirstEventPages(async page => {
    requestedPages.push(page);
    return pages[page - 1];
  });

  assert.deepEqual(requestedPages, [1, 2, 3]);
  assert.equal(pages[0].events.length, 2);
  assert.deepEqual(result.events.map(event => (event as { code: string }).code), ["MEX01", "USA01", "CAN01", "BRA01"]);
  const normalized = normalizeEvents({ events: result.events }, 2026);
  assert.equal(normalized.find(event => event.code === "MEX01")?.type, "Regional Championship");
  assert.equal(normalized.find(event => event.code === "BRA01")?.country, "Brazil");
});

test("rejects malformed FIRST pages instead of silently reporting an empty event list", async () => {
  await assert.rejects(getAllFirstEventPages(async () => ({ pageTotal: 2 })), /página sin una lista válida/);
});

test("distinguishes scheduled, pending and zero-point official match results", () => {
  const normalized = normalizeHybridSchedule({ schedule: [
    { matchNumber: 1, tournamentLevel: "qual", startTime: "2027-01-01T10:00:00", teams: [{ station: "Red1", teamNumber: 1 }, { station: "Blue1", teamNumber: 2 }] },
    { matchNumber: 2, actualStartTime: "2027-01-01T11:00:00", teams: [] },
    { matchNumber: 3, tournamentLevel: "qual", scoreRedFinal: 0, scoreBlueFinal: 0, scoreRedAuto: 0, scoreBlueAuto: 0, scoreRedFoul: 0, scoreBlueFoul: 0, scoreRedDriveControlled: 0, scoreBlueDriveControlled: 0, teams: [] },
  ] }, 2027, "MABOS", "qual");
  assert.deepEqual(normalized.map(match => match.status), ["scheduled", "result_pending", "played"]);
  assert.equal(normalized[2].redFinal, 0);
  assert.equal(normalized[2].redDriveControlled, 0);
  assert.equal(normalized[2].blueDriveControlled, 0);
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

test("scopes official match identity by season, event, tournament level and official match identifiers", () => {
  const qual = normalizeHybridSchedule({ schedule: [{ series: 2, matchNumber: 4, teams: [] }] }, 2026, "USALATQ", "qual")[0];
  const playoff = normalizeHybridSchedule({ schedule: [{ series: 2, matchNumber: 4, teams: [] }] }, 2026, "USALATQ", "playoff")[0];
  const nextSeason = normalizeHybridSchedule({ schedule: [{ series: 2, matchNumber: 4, teams: [] }] }, 2027, "USALATQ", "qual")[0];
  const nextEvent = normalizeHybridSchedule({ schedule: [{ series: 2, matchNumber: 4, teams: [] }] }, 2026, "OTHER", "qual")[0];
  assert.equal(new Set([qual.id, playoff.id, nextSeason.id, nextEvent.id]).size, 4);
});

test("deduplicates repeated FIRST schedule rows with the same stable match identity", () => {
  const matches = normalizeHybridSchedule({ schedule: [
    { series: 0, matchNumber: 1, teams: [{ station: "Red1", teamNumber: 101 }] },
    { series: 0, matchNumber: 1, scoreRedFinal: 20, scoreBlueFinal: 18, teams: [{ station: "Red1", teamNumber: 101 }, { station: "Blue1", teamNumber: 202 }] },
  ] }, 2026, "USALATQ", "qual");
  assert.equal(matches.length, 1);
  assert.equal(matches[0].status, "played");
  assert.equal(matches[0].redFinal, 20);
  assert.deepEqual(matches[0].blueTeams.map(team => team.number), [202]);
});
