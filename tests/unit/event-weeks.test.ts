import assert from "node:assert/strict";
import test from "node:test";
import { classifyEventWeeks } from "../../lib/first/event-weeks.ts";
import type { OfficialEvent } from "../../lib/first/normalize.ts";

const event = (code: string, name: string, dateStart: string | null, dateEnd: string | null = null): OfficialEvent => ({
  id: code, code, name, venue: null, address: null, city: null, stateProv: null, country: null,
  dateStart, dateEnd, type: null,
});

test("uses the official kickoff event date and keeps weeks beyond eight", () => {
  const result = classifyEventWeeks([
    event("KICKOFF", "BIOBUZZ Kickoff", "2026-09-12", "2026-09-12"),
    event("WEEK1", "Weekend event", "2026-09-18"),
    event("WEEK2", "Next-week event", "2026-09-19"),
    event("WEEK8", "Week eight", "2026-10-31"),
    event("WEEK11", "Week eleven", "2026-11-27"),
    event("PRESEASON", "Preseason event", "2026-09-11"),
    event("UNDATED", "No date", null),
  ]);

  assert.equal(result.kickoffDate, "2026-09-12");
  assert.equal(result.groups.length, 12);
  assert.deepEqual(result.groups[0].events.map(item => item.code), ["KICKOFF", "WEEK1"]);
  assert.deepEqual(result.groups[1].events.map(item => item.code), ["WEEK2"]);
  assert.deepEqual(result.groups[7].events.map(item => item.code), ["WEEK8"]);
  assert.deepEqual(result.groups[10].events.map(item => item.code), ["WEEK11"]);
  assert.deepEqual(result.groups.at(-1)?.events.map(item => item.code), ["PRESEASON", "UNDATED"]);
});

test("does not guess weeks if no official kickoff date is present", () => {
  const result = classifyEventWeeks([event("KNOWN", "Regional", "2026-10-12"), event("UNKNOWN", "No date", null)]);
  assert.equal(result.kickoffDate, null);
  assert.equal(result.groups.length, 1);
  assert.deepEqual(result.groups[0].events.map(item => item.code), ["KNOWN", "UNKNOWN"]);
});

test("uses event start date to assign multi-day events", () => {
  const result = classifyEventWeeks([
    event("KICKOFF", "Season Kickoff", "2026-09-12"),
    event("MULTI", "Regional", "2026-09-18", "2026-09-20"),
  ]);
  assert.deepEqual(result.groups[0].events.map(item => item.code), ["KICKOFF", "MULTI"]);
});

test("uses each season's own kickoff anchor instead of carrying weeks across seasons", () => {
  const season2025 = classifyEventWeeks([
    event("KICKOFF25", "Season Kickoff", "2025-09-06"),
    event("WEEK11-25", "Later event", "2025-11-15"),
    event("UNDATED25", "Unscheduled", null),
  ]);
  const season2026 = classifyEventWeeks([
    event("KICKOFF26", "Season Kickoff", "2026-09-12"),
    event("WEEK11-26", "Later event", "2026-11-21"),
    event("UNDATED26", "Unscheduled", null),
  ]);

  assert.equal(season2025.kickoffDate, "2025-09-06");
  assert.equal(season2026.kickoffDate, "2026-09-12");
  assert.deepEqual(season2025.groups[10].events.map(item => item.code), ["WEEK11-25"]);
  assert.deepEqual(season2026.groups[10].events.map(item => item.code), ["WEEK11-26"]);
  assert.equal(season2025.groups.at(-1)?.events[0].code, "UNDATED25");
  assert.equal(season2026.groups.at(-1)?.events[0].code, "UNDATED26");
});

test("matches published FTC Event Web week examples from two real seasons", () => {
  // Official references: 2025 kickoff (Sep 6) and USMISCLT (Week 13, Dec 5);
  // 2026 USILPEKO kickoff (Sep 12) and MXTLQ (Week 11, Nov 27).
  const decode = classifyEventWeeks([
    event("KICKOFF25", "DECODE Kickoff", "2025-09-06"),
    event("USMISCLT", "USMISCLT", "2025-12-05", "2025-12-06"),
  ]);
  const biobuzz = classifyEventWeeks([
    event("USILPEKO", "BIOBUZZ Kickoff", "2026-09-12"),
    event("MXTLQ", "Regional CDMX", "2026-11-27", "2026-11-28"),
  ]);

  assert.deepEqual(decode.groups[12].events.map(item => item.code), ["USMISCLT"]);
  assert.deepEqual(biobuzz.groups[10].events.map(item => item.code), ["MXTLQ"]);
});
