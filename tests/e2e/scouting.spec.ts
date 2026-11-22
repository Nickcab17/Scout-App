import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("uses FIRST match data, records zero pollen, persists locally, and hides manual Teams", async ({ page }) => {
  await page.route("**/api/first/seasons", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ maxSeason: 2026 }),
  }));
  await page.route("**/api/first/events?*", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ events: [{ code: "TEST1", name: "Evento FIRST de prueba local", city: "Austin", stateProv: "TX", country: "USA" }], syncedAt: new Date().toISOString() }),
  }));
  await page.route("**/api/first/events/TEST1/teams?*", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ teams: [
      { teamNumber: 9101, nameFull: "Equipo Oficial A" },
      { teamNumber: 9102, nameFull: "Equipo Oficial B" },
      { teamNumber: 9201, nameFull: "Equipo Oficial C" },
      { teamNumber: 9202, nameFull: "Equipo Oficial D" },
      { teamNumber: 9301, nameFull: "Equipo Fuera del Partido" },
    ] }),
  }));
  await page.route("**/api/first/events/TEST1/schedule?*level=qual*", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ schedule: [{
      matchNumber: 14,
      description: "Qualification 14",
      teams: [
        { station: "Red1", teamNumber: 9101, teamName: "Equipo Oficial A" },
        { station: "Red2", teamNumber: 9102, teamName: "Equipo Oficial B" },
        { station: "Blue1", teamNumber: 9201, teamName: "Equipo Oficial C" },
        { station: "Blue2", teamNumber: 9202, teamName: "Equipo Oficial D" },
      ],
    }] }),
  }));
  await page.route("**/api/first/events/TEST1/schedule?*level=playoff*", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ schedule: [] }),
  }));

  await page.evaluate(() => {
    localStorage.setItem("biobuzz-active-first-event-v1", JSON.stringify({ season: 2026, eventCode: "TEST1", eventName: "Evento FIRST de prueba local" }));
  });
  await page.reload();
  await expect(page.getByRole("button", { name: "Teams" })).toHaveCount(0);
  await page.getByRole("button", { name: "Match Scouting" }).click();
  await page.getByLabel("Partido oficial").selectOption({ index: 1 });
  await expect(page.getByLabel("Equipo participante observado").locator("option")).toHaveCount(5);
  await expect(page.getByLabel("Equipo participante observado")).not.toContainText("9301");
  await page.getByLabel("Equipo participante observado").selectOption("9102");
  await page.getByRole("tab", { name: "TELEOP" }).click();
  await page.getByRole("spinbutton", { name: "POLLEN lanzado hacia CELLS", exact: true }).fill("0");
  await page.getByRole("button", { name: "Guardar observación" }).click();
  await expect(page.getByText("Guardado localmente")).toBeVisible();
  await expect(page.getByRole("spinbutton", { name: "POLLEN lanzado hacia CELLS", exact: true })).toHaveValue("0");

  await page.getByRole("spinbutton", { name: "POLLEN lanzado hacia CELLS", exact: true }).fill("7");
  await page.getByRole("button", { name: "Guardar observación" }).click();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}").observations.length)).toBe(2);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}"));
  expect(saved.observations).toHaveLength(2);
  expect(saved.observations[0]).toMatchObject({
    teamNumber: 9102,
    pollenCount: 0,
    alliance: "red",
    season: 2026,
    eventCode: "TEST1",
  });
  expect(saved.observations[1]).toMatchObject({ teamNumber: 9102, pollenCount: 7, alliance: "red", eventCode: "TEST1" });
  await page.reload();
  await page.getByRole("button", { name: "Match Scouting" }).click();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}").observations.length)).toBe(2);
});

test("rejects invalid pollen and preserves the submitted count after reload", async ({ page }) => {
  await page.getByRole("button", { name: "Match Scouting" }).click();
  await page.getByRole("tab", { name: "TELEOP" }).click();
  await page.getByRole("spinbutton", { name: "POLLEN lanzado hacia CELLS", exact: true }).fill("-1");
  await expect(page.getByRole("spinbutton", { name: "POLLEN lanzado hacia CELLS", exact: true })).toHaveValue("-1");
  await expect(page.getByRole("button", { name: "Guardar observación" })).toBeDisabled();
});

test("applies and remembers appearance preferences in this browser", async ({ page }) => {
  await page.getByRole("button", { name: "Datos y ajustes" }).click();
  await page.getByRole("button", { name: "Ocean" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--bg"))).toBe("#0e171d");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-theme-v1") || "{}").primary)).toBe("#267fba");
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--bg"))).toBe("#0e171d");
});

test("switches FTC and FRC modes and removes the Quality card", async ({ page }) => {
  await expect(page.getByText("Calidad de datos")).toHaveCount(0);
  await page.getByRole("button", { name: "FRC" }).click();
  await expect(page.getByText("Coming Soon...")).toBeVisible();
  await page.getByRole("button", { name: "Volver a FTC" }).click();
  await expect(page.getByRole("heading", { name: "Centro de scouting" })).toBeVisible();
});

test("shows independent pollen and nectar flower counters", async ({ page }) => {
  await page.getByRole("button", { name: "Match Scouting" }).click();
  await page.getByRole("tab", { name: "TELEOP" }).click();
  await expect(page.getByText("POLLEN", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("NECTAR", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("FLOWER 1", { exact: true })).toBeVisible();
  await expect(page.getByText("FLOWER 2", { exact: true })).toBeVisible();
  await expect(page.getByText("FLOWER 3", { exact: true })).toBeVisible();
  await expect(page.getByText("FLOWER 4", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ayuda: POLLEN lanzado hacia CELLS" })).toBeVisible();
});

test("confirms one active FIRST event and preserves it after reload", async ({ page }) => {
  await page.route("**/api/first/seasons", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ maxSeason: 2026 }),
  }));
  await page.route("**/api/first/events?*", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ events: [
      { id: "evt-a", code: "TESTA", name: "Regional A", city: "Austin", season: 2026 },
      { id: "evt-b", code: "TESTB", name: "Regional B", city: "Boston", season: 2026 },
      { id: "evt-old", code: "OLD25", name: "Regional anterior", season: 2025 },
    ], syncedAt: new Date().toISOString() }),
  }));
  await page.route("**/api/first/events/TESTA/teams?*", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ teams: [
      { teamNumber: 9101, nameFull: "A Red 1" }, { teamNumber: 9102, nameFull: "A Red 2" },
      { teamNumber: 9201, nameFull: "A Blue 1" }, { teamNumber: 9202, nameFull: "A Blue 2" },
      { teamNumber: 9999, nameFull: "A Outside" },
    ] }),
  }));
  await page.route("**/api/first/events/TESTB/teams?*", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ teams: [
      { teamNumber: 8101, nameFull: "B Red 1" }, { teamNumber: 8102, nameFull: "B Red 2" },
      { teamNumber: 8201, nameFull: "B Blue 1" }, { teamNumber: 8202, nameFull: "B Blue 2" },
    ] }),
  }));
  await page.route("**/api/first/events/TESTA/schedule?*", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ matches: [{
      id: "2026:TESTA:qual:0:14", level: "qual", series: 0, number: 14, description: "A Qualification 14",
      redTeams: [{ number: 9101, name: "A Red 1" }, { number: 9102, name: "A Red 2" }],
      blueTeams: [{ number: 9201, name: "A Blue 1" }, { number: 9202, name: "A Blue 2" }],
      redFinal: 100, blueFinal: 90, status: "played",
    }], syncedAt: new Date().toISOString(), persisted: false }),
  }));
  await page.route("**/api/first/events/TESTB/schedule?*", route => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ matches: [{
      id: "2026:TESTB:qual:0:24", level: "qual", series: 0, number: 24, description: "B Qualification 24",
      redTeams: [{ number: 8101, name: "B Red 1" }, { number: 8102, name: "B Red 2" }],
      blueTeams: [{ number: 8201, name: "B Blue 1" }, { number: 8202, name: "B Blue 2" }],
      redFinal: 200, blueFinal: 180, status: "played",
    }], syncedAt: new Date().toISOString(), persisted: false }),
  }));
  await page.route("**/api/first/events/TESTA/results/**", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ matches: [] }),
  }));
  await page.route("**/api/first/events/TESTB/results/**", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ matches: [] }),
  }));
  await page.route("**/api/first/events/TESTA/scores/**", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ scoreDetails: [] }),
  }));
  await page.route("**/api/first/events/TESTB/scores/**", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ scoreDetails: [] }),
  }));

  await expect(page.getByRole("button", { name: "FIRST Events" })).toHaveCount(1);
  for (const removedMenu of ["Events", "Match Schedule", "Official Results"]) {
    await expect(page.getByRole("button", { name: removedMenu, exact: true })).toHaveCount(0);
  }
  await page.getByRole("button", { name: "FIRST Events" }).click();
  await expect(page.getByRole("heading", { name: "FIRST Events" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Eventos FIRST disponibles" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Calendario de partidos" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Resultados oficiales FIRST" })).toBeVisible();
  await expect(page.getByLabel("Regional para trabajar")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Confirmar evento activo" })).toHaveCount(1);
  const schedulePanel = page.getByRole("region", { name: "Calendario de partidos" });
  const officialResults = page.getByRole("region", { name: "Resultados oficiales FIRST" });
  await page.getByLabel("Regional para trabajar").selectOption("TESTA");
  await page.getByRole("button", { name: "Confirmar evento activo" }).click();
  await expect(page.getByRole("button", { name: "Confirmar evento activo" })).toBeDisabled();
  await expect(page.getByLabel("Regional para trabajar").locator("option[value='OLD25']")).toHaveCount(0);
  await expect(schedulePanel.getByText("A Qualification 14", { exact: false })).toBeVisible();
  await expect(officialResults.getByText("A Qualification 14", { exact: false })).toBeVisible();
  await expect(page.getByText("Regional A", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Regional anterior", { exact: true })).toHaveCount(0);
  await expect(officialResults.getByText("100", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Resumen individual estimado", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Match Scouting" }).click();
  await expect(page.getByText("Regional A", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Regional para trabajar")).toHaveCount(0);
  await page.getByLabel("Partido oficial").selectOption({ index: 1 });
  const firstRegionalRobots = await page.getByLabel("Equipo participante observado").locator("option").allTextContents();
  expect(firstRegionalRobots.join(" ")).toContain("9101");
  expect(firstRegionalRobots.join(" ")).toContain("9202");
  expect(firstRegionalRobots.join(" ")).not.toContain("8101");
  await expect(page.getByText("Resumen individual estimado", { exact: true })).toBeVisible();
  await page.getByLabel("Equipo participante observado").selectOption("9101");
  await page.getByRole("button", { name: "Guardar observación" }).click();
  await expect(page.getByText("Guardado localmente")).toBeVisible();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}").observations?.length ?? 0)).toBe(1);
  const firstObservation = await page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}").observations[0]);
  expect(firstObservation).toMatchObject({ teamNumber: 9101, season: 2026, eventCode: "TESTA", tournamentLevel: "qual", officialMatchId: "2026:TESTA:qual:0:14" });

  await page.reload();
  await page.getByRole("button", { name: "FIRST Events" }).click();
  await expect(page.getByText("Regional A", { exact: true }).first()).toBeVisible();
  await page.reload();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}").observations?.length ?? 0)).toBe(1);

  await page.getByRole("button", { name: "FIRST Events" }).click();
  await page.getByLabel("Regional para trabajar").selectOption("TESTB");
  await page.getByRole("button", { name: "Confirmar evento activo" }).click();
  await expect(page.getByRole("button", { name: "Confirmar evento activo" })).toBeDisabled();

  await expect(page.getByText("Regional B", { exact: true }).first()).toBeVisible();
  const previousEvent = page.locator(".official-event-row").filter({ hasText: "Regional A" });
  await expect(previousEvent).toBeVisible();
  await expect(previousEvent.locator(".official-badge")).toHaveCount(0);
  await expect(schedulePanel.getByText("B Qualification 24", { exact: false })).toBeVisible();
  await expect(officialResults.getByText("B Qualification 24", { exact: false })).toBeVisible();
  await expect(schedulePanel.getByText("A Qualification 14", { exact: false })).toHaveCount(0);
  await expect(officialResults.getByText("A Qualification 14", { exact: false })).toHaveCount(0);
  await expect(officialResults.getByText("200", { exact: true }).first()).toBeVisible();
  await expect(officialResults.getByText("100", { exact: true })).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}").observations?.length ?? 0)).toBe(1);

  await page.reload();
  await page.getByRole("button", { name: "FIRST Events" }).click();
  await expect(page.getByText("Regional B", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("region", { name: "Calendario de partidos" }).getByText("B Qualification 24", { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Match Scouting" }).click();
  await page.getByLabel("Partido oficial").selectOption({ index: 1 });
  const robotOptions = await page.getByLabel("Equipo participante observado").locator("option").allTextContents();
  expect(robotOptions.join(" ")).toContain("8101");
  expect(robotOptions.join(" ")).toContain("8202");
  expect(robotOptions.join(" ")).not.toContain("9101");
  expect(robotOptions.join(" ")).not.toContain("9999");

  const preserved = await page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}").observations);
  expect(preserved.some((observation: { eventCode?: string }) => observation.eventCode === "TESTA")).toBe(true);
});

test("ignores a delayed schedule response after switching to another regional", async ({ page }) => {
  await page.route("**/api/first/events?*", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ events: [
      { id: "evt-a", code: "TESTA", name: "Regional A", season: 2026 },
      { id: "evt-b", code: "TESTB", name: "Regional B", season: 2026 },
    ] }),
  }));
  await page.route("**/api/first/events/TESTA/schedule?*", async route => {
    await new Promise(resolve => setTimeout(resolve, 750));
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matches: [{
      id: "2026:TESTA:qual:0:1", level: "qual", series: 0, number: 1, description: "Delayed A match",
      redTeams: [], blueTeams: [], redFinal: null, blueFinal: null, status: "scheduled",
    }] }) });
  });
  await page.route("**/api/first/events/TESTB/schedule?*", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ matches: [{
      id: "2026:TESTB:qual:0:2", level: "qual", series: 0, number: 2, description: "Current B match",
      redTeams: [], blueTeams: [], redFinal: null, blueFinal: null, status: "scheduled",
    }] }),
  }));
  await page.route("**/api/first/events/TESTA/teams?*", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ teams: [] }) }));
  await page.route("**/api/first/events/TESTB/teams?*", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ teams: [] }) }));
  await page.route("**/api/first/events/TESTA/results/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matches: [] }) }));
  await page.route("**/api/first/events/TESTB/results/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ matches: [] }) }));
  await page.route("**/api/first/events/TESTA/scores/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ scoreDetails: [] }) }));
  await page.route("**/api/first/events/TESTB/scores/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ scoreDetails: [] }) }));

  await page.getByRole("button", { name: "FIRST Events" }).click();
  await page.getByLabel("Regional para trabajar").selectOption("TESTA");
  await page.getByRole("button", { name: "Confirmar evento activo" }).click();
  await page.getByLabel("Regional para trabajar").selectOption("TESTB");
  await page.getByRole("button", { name: "Confirmar evento activo" }).click();
  await expect(page.getByText("Current B match", { exact: false })).toBeVisible();
  await page.waitForTimeout(1000);
  await expect(page.getByText("Delayed A match", { exact: false })).toHaveCount(0);
  await expect(page.getByText("Current B match", { exact: false })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-active-first-event-v1") || "{}").eventCode)).toBe("TESTB");
  await expect(page.getByText("FIRST todavía no ha publicado resultados para este evento y nivel.", { exact: true })).toBeVisible();
  await expect(page.getByText("Delayed A match", { exact: false })).toHaveCount(0);
});

test("keeps events beyond the first selector page searchable and selectable", async ({ page }) => {
  const events = Array.from({ length: 61 }, (_, index) => ({
    id: `event-${index + 1}`,
    code: `EVT${String(index + 1).padStart(3, "0")}`,
    name: `Regional ${index + 1}`,
    type: index % 2 === 0 ? "Qualifier" : "Kickoff",
    city: index === 60 ? "Ciudad de México" : "City",
    country: index === 60 ? "Mexico" : "USA",
    season: 2026,
  }));
  await page.route("**/api/first/events?*", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ events, syncedAt: new Date().toISOString(), pageTotal: 2 }),
  }));
  await page.route("**/api/first/events/EVT061/teams?*", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ teams: [] }),
  }));
  await page.route("**/api/first/events/EVT061/schedule?*", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ matches: [], syncedAt: new Date().toISOString() }),
  }));
  await page.route("**/api/first/events/EVT061/results/**", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ matches: [] }),
  }));
  await page.route("**/api/first/events/EVT061/scores/**", route => route.fulfill({
    status: 200, contentType: "application/json", body: JSON.stringify({ scoreDetails: [] }),
  }));

  await page.getByRole("button", { name: "FIRST Events" }).click();
  await expect(page.locator(".official-event-row")).toHaveCount(61);
  await expect(page.getByText("Mexico", { exact: false }).last()).toBeVisible();
  await page.getByLabel("Buscar eventos de FIRST · temporada 2026").fill("Regional 61");
  await expect(page.getByLabel("Regional para trabajar").locator("option[value='EVT061']")).toContainText("Regional · Qualifier");
  await page.getByLabel("Regional para trabajar").selectOption("EVT061");
  await page.getByRole("button", { name: "Confirmar evento activo" }).click();
  await expect(page.getByText("Evento FIRST 2026 · EVT061")).toBeVisible();
});
