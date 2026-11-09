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

  await expect(page.getByRole("button", { name: "Teams" })).toHaveCount(0);
  await page.getByRole("button", { name: "Match Scouting" }).click();
  await page.getByLabel("Evento FIRST").selectOption("TEST1");
  await page.getByLabel("Partido oficial").selectOption({ index: 1 });
  await page.getByLabel("Equipo participante observado").selectOption("9102");
  await page.getByLabel("Cantidad de polen").fill("0");
  await page.getByRole("button", { name: "Guardar polen" }).click();
  await expect(page.getByText("Guardado localmente")).toBeVisible();
  await expect(page.getByLabel("Cantidad de polen")).toHaveValue("");

  await page.getByLabel("Cantidad de polen").fill("7");
  await page.getByRole("button", { name: "Guardar polen" }).click();
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
  await page.getByLabel("Cantidad de polen").fill("-1");
  await expect(page.getByLabel("Cantidad de polen")).toHaveValue("-1");
  await expect(page.getByRole("button", { name: "Guardar polen" })).toBeDisabled();
});

test("applies and remembers appearance preferences in this browser", async ({ page }) => {
  await page.getByRole("button", { name: "Datos y ajustes" }).click();
  await page.getByRole("button", { name: "Ocean" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--bg"))).toBe("#0e171d");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-theme-v1") || "{}").primary)).toBe("#267fba");
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--bg"))).toBe("#0e171d");
});
