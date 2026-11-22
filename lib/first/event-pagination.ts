type FirstEventPage = { events?: unknown; pageTotal?: unknown; totalPages?: unknown; pageCount?: unknown; [key: string]: unknown };

function isRecord(value: unknown): value is FirstEventPage {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getPageTotal(payload: unknown): number {
  if (!isRecord(payload)) return 1;
  for (const candidate of [payload.pageTotal, payload.totalPages, payload.pageCount]) {
    const parsed = typeof candidate === "number" ? candidate : typeof candidate === "string" ? Number(candidate) : NaN;
    if (Number.isSafeInteger(parsed) && parsed > 0) return parsed;
  }
  return 1;
}

function getPageEvents(payload: unknown): unknown[] {
  if (!isRecord(payload) || !Array.isArray(payload.events)) {
    throw new Error("FIRST devolvió una página sin una lista válida de eventos.");
  }
  return payload.events;
}

export async function getAllFirstEventPages(fetchPage: (page: number) => Promise<unknown>) {
  const firstPage = await fetchPage(1);
  const pageTotal = getPageTotal(firstPage);
  const events = [...getPageEvents(firstPage)];
  for (let page = 2; page <= pageTotal; page++) {
    events.push(...getPageEvents(await fetchPage(page)));
  }

  const unique = new Map<string, unknown>();
  for (const event of events) {
    if (!isRecord(event)) continue;
    const id = typeof event.eventId === "string" || typeof event.eventId === "number" ? String(event.eventId) : "";
    const code = typeof event.code === "string" ? event.code.trim().toUpperCase() : "";
    const key = id ? `id:${id}` : `code:${code}`;
    if (code && !unique.has(key)) unique.set(key, event);
  }
  return { events: [...unique.values()], pageTotal };
}
