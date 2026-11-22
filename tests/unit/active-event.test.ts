import test from "node:test";
import assert from "node:assert/strict";
import { ACTIVE_FIRST_EVENT_KEY, readActiveFirstEvent, writeActiveFirstEvent } from "../../lib/first/active-event.ts";

test("active FIRST event round-trips and normalizes event codes", () => {
  const values = new Map<string, string>();
  (globalThis as unknown as { localStorage: { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void } }).localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  (globalThis as unknown as { window: { dispatchEvent: (event: unknown) => void } }).window = { dispatchEvent: () => {} };
  (globalThis as unknown as { CustomEvent: new (type: string, init: { detail: unknown }) => unknown }).CustomEvent =
    class {
      type: string;
      init: { detail: unknown };
      constructor(type: string, init: { detail: unknown }) {
        this.type = type;
        this.init = init;
      }
    } as never;

  writeActiveFirstEvent({ season: 2026, eventCode: " auabc ", eventId: "evt-1", eventName: "Regional A" });

  assert.equal(values.has(ACTIVE_FIRST_EVENT_KEY), true);
  assert.deepEqual(readActiveFirstEvent(), {
    season: 2026,
    eventCode: "AUABC",
    eventId: "evt-1",
    eventName: "Regional A",
  });

  values.set(ACTIVE_FIRST_EVENT_KEY, JSON.stringify({ season: 2025, eventCode: "OLD25" }));
  assert.equal(readActiveFirstEvent(), null);
  assert.throws(() => writeActiveFirstEvent({ season: 2025, eventCode: "OLD25" }), /temporada 2026/);
});
