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
      { id: "evt-a", code: "TESTA", name: "Regional A", city: "Austin" },
      { id: "evt-b", code: "TESTB", name: "Regional B", city: "Boston" },
    ], syncedAt: new Date().toISOString() }),
  }));

  await page.getByRole("button", { name: "Events" }).click();
  await page.getByRole("combobox", { name: "Evento oficial" }).selectOption("TESTA");
  await page.getByRole("button", { name: "Confirmar evento activo" }).click();
  await expect(page.getByText("Evento activo:", { exact: false })).toContainText("Regional A");

  await page.getByRole("button", { name: "Match Schedule" }).click();
  await expect(page.getByText("Evento activo:", { exact: false })).toContainText("Regional A");

  await page.getByRole("button", { name: "Official Results" }).click();
  await expect(page.getByText("Evento activo:", { exact: false })).toContainText("Regional A");

  await page.reload();
  await page.getByRole("button", { name: "Match Schedule" }).click();
  await expect(page.getByText("Evento activo:", { exact: false })).toContainText("Regional A");
});
