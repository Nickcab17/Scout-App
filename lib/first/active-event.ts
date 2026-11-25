import { isSupportedFirstSeason } from "./season.ts";

export type ActiveFirstEvent = {
  season: number;
  eventCode: string;
  eventId?: string;
  eventName?: string;
};

export const ACTIVE_FIRST_EVENT_KEY = "biobuzz-active-first-event-v1";

export function readActiveFirstEvent(): ActiveFirstEvent | null {
  try {
    const raw = localStorage.getItem(ACTIVE_FIRST_EVENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ActiveFirstEvent>;
    if (typeof parsed.season !== "number" || !isSupportedFirstSeason(parsed.season) || typeof parsed.eventCode !== "string" || !parsed.eventCode.trim()) return null;
    return {
      season: Number(parsed.season),
      eventCode: parsed.eventCode.trim().toUpperCase(),
      eventId: typeof parsed.eventId === "string" ? parsed.eventId : undefined,
      eventName: typeof parsed.eventName === "string" ? parsed.eventName : undefined,
    };
  } catch {
    return null;
  }
}

export function writeActiveFirstEvent(selection: ActiveFirstEvent) {
  if (!isSupportedFirstSeason(selection.season) || !/^[a-z\d]{3,30}$/i.test(selection.eventCode.trim())) {
    throw new Error("La temporada o el código del evento FIRST no son válidos.");
  }
  const normalized = {
    season: selection.season,
    eventCode: selection.eventCode.trim().toUpperCase(),
    eventId: selection.eventId,
    eventName: selection.eventName,
  };
  localStorage.setItem(ACTIVE_FIRST_EVENT_KEY, JSON.stringify(normalized));

  try {
    const raw = localStorage.getItem("biobuzz-first-v1");
    const store = raw ? JSON.parse(raw) as { selections?: Record<string, unknown>; schedules?: Record<string, unknown> } : { selections: {}, schedules: {} };
    store.selections = { ...(store.selections ?? {}), local: { season: normalized.season, eventCode: normalized.eventCode } };
    localStorage.setItem("biobuzz-first-v1", JSON.stringify(store));
  } catch {}

  window.dispatchEvent(new CustomEvent("biobuzz:active-first-event", { detail: normalized }));
}
