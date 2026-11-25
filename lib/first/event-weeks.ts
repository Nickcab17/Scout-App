import type { OfficialEvent } from "./normalize.ts";

export type EventWeekGroup = { key: string; title: string; events: OfficialEvent[] };
export type EventWeekClassification = { kickoffDate: string | null; groups: EventWeekGroup[] };

function dateOnly(value: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(timestamp);
  return date.getUTCFullYear() === Number(match[1]) && date.getUTCMonth() === Number(match[2]) - 1 && date.getUTCDate() === Number(match[3]) ? timestamp : null;
}

function findKickoffDate(events: OfficialEvent[]): string | null {
  const kickoffDates = events.flatMap(event => {
    if (!/\bkickoff\b/i.test(event.name) || /\bbefore\s+kickoff\b/i.test(event.name) || !event.dateStart || dateOnly(event.dateStart) === null) return [];
    return [event.dateStart.slice(0, 10)];
  }).sort();
  return kickoffDates[0] ?? null;
}

/**
 * FTC Event Web labels an event's week as "Week N since kickoff". BioBuzz
 * applies that 7-day, kickoff-relative convention to the official API start
 * date. The kickoff anchor is taken only from an official event whose name
 * identifies it as a kickoff; without that source date, dated events remain
 * unassigned instead of guessing a season calendar.
 */
export function classifyEventWeeks(events: OfficialEvent[]): EventWeekClassification {
  const kickoffDate = findKickoffDate(events);
  const kickoffTimestamp = kickoffDate ? dateOnly(kickoffDate) : null;
  const weekEvents = new Map<number, OfficialEvent[]>();
  const other: OfficialEvent[] = [];

  for (const event of events) {
    const start = event.dateStart ? dateOnly(event.dateStart) : null;
    if (start === null || kickoffTimestamp === null || start < kickoffTimestamp) {
      other.push(event);
      continue;
    }
    const week = Math.floor((start - kickoffTimestamp) / 604800000) + 1;
    weekEvents.set(week, [...(weekEvents.get(week) ?? []), event]);
  }

  const maxWeek = Math.max(0, ...weekEvents.keys());
  const groups = Array.from({ length: maxWeek }, (_, index) => {
    const week = index + 1;
    return { key: `week-${week}`, title: `Semana ${week}`, events: weekEvents.get(week) ?? [] };
  });
  groups.push({ key: "other", title: "Otros eventos / sin semana asignada", events: other });
  return { kickoffDate, groups };
}
