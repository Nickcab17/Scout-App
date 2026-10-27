import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

test("starts empty, validates data, isolates robot panels, and persists observations", async ({ page }) => {
  await expect(page.getByText("Aún no hay partidos")).toBeVisible();
  await expect(page.locator(".metric-value").first()).toHaveText("0");

  await page.getByRole("button", { name: "Equipos" }).click();
  await page.getByLabel("Número de equipo").fill("9101");
  await page.getByRole("button", { name: "Agregar equipo" }).click();
  await expect(page.locator(".team-row")).toHaveCount(0);

  const names = ["Prueba FTC A", "Prueba FTC B", "Prueba FTC C", "Prueba FTC D"];
  for (let i = 0; i < 4; i++) {
    await page.getByLabel("Número de equipo").fill(String(9101 + i));
    await page.getByLabel("Nombre del equipo").fill(names[i]);
    await page.getByRole("button", { name: "Agregar equipo" }).click();
  }
  await expect(page.locator(".team-row")).toHaveCount(4);

  await page.getByLabel("Número de equipo").fill("9101");
  await page.getByLabel("Nombre del equipo").fill("Duplicado local");
  await page.getByRole("button", { name: "Agregar equipo" }).click();
  await expect(page.getByText(/Ya existe un equipo con ese número/)).toBeVisible();
  await expect(page.locator(".team-row")).toHaveCount(4);

  await page.getByRole("button", { name: "Scouting de partido" }).click();
  await page.getByLabel("Número de partido").fill("14");
  await page.getByPlaceholder("Nombre del evento").fill("Evento de prueba E2E");
  await page.getByRole("button", { name: "Crear partido" }).click();
  await expect(page.getByText(/Asigna un equipo registrado/)).toBeVisible();
  await expect(page.locator(".side-match")).toHaveCount(0);
  for (let i = 0; i < 4; i++) await page.locator(".position-grid select").nth(i).selectOption(String(9101 + i));
  await page.getByRole("button", { name: "Crear partido" }).click();
  await expect(page.getByText("Partido registrado", { exact: true })).toBeVisible();

  await page.getByLabel(/Seleccionar partido/).selectOption("");
  await page.getByLabel("Número de partido").fill("14");
  await page.locator(".match-form input").nth(1).fill(" evento de prueba e2e ");
  for (let i = 0; i < 4; i++) await page.locator(".position-grid select").nth(i).selectOption(String(9101 + i));
  await page.getByRole("button", { name: "Crear partido" }).click();
  await expect(page.getByText("Partido duplicado")).toBeVisible();
  await expect(page.locator(".side-match")).toHaveCount(1);
  await page.getByLabel(/Seleccionar partido/).selectOption({ label: "M14 · Evento de prueba E2E" });

  await page.getByRole("button", { name: /Guardar borrador/ }).click();
  await expect(page.getByText(/Agrega una observacion/)).toBeVisible();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}"));
  expect(saved.observations).toHaveLength(0);

  await page.getByPlaceholder(/Acciones aut/).fill("AUTO real robot 9101");
  await page.getByRole("button", { name: /Guardar borrador/ }).click();
  await expect(page.getByText("Borrador guardado")).toBeVisible();
  await page.locator(".robot-tab").nth(1).click();
  await page.getByPlaceholder(/Acciones aut/).fill("AUTO real robot 9102");
  await page.getByRole("button", { name: /Guardar registro/ }).click();
  await expect(page.getByText("Registro guardado localmente")).toBeVisible();
  await page.locator(".robot-tab").nth(0).click();
  await expect(page.getByPlaceholder(/Acciones aut/)).toHaveValue("AUTO real robot 9101");

  await expect.poll(async () => page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}").observations.length)).toBe(2);
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}"));
  expect(saved.observations.map((item: { teamNumber: number; auto: string }) => [item.teamNumber, item.auto])).toEqual([
    [9101, "AUTO real robot 9101"], [9102, "AUTO real robot 9102"],
  ]);

  await page.reload();
  await page.getByRole("button", { name: "Scouting de partido" }).click();
  await page.getByLabel("Seleccionar partido").selectOption({ label: "M14 · Evento de prueba E2E" });
  await page.locator(".robot-tab").nth(0).click();
  await expect(page.getByPlaceholder(/Acciones aut/)).toHaveValue("AUTO real robot 9101");
  await page.locator(".robot-tab").nth(1).click();
  await expect(page.getByPlaceholder(/Acciones aut/)).toHaveValue("AUTO real robot 9102");

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".robot-tab")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.getByRole("button", { name: "Scouting de partido" })).toBeVisible();
  expect(await page.getByRole("button", { name: "Scouting de partido" }).evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
  expect(await page.getByLabel(/Seleccionar partido/).evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
});

test("applies and remembers appearance preferences in this browser", async ({ page }) => {
  await page.getByRole("button", { name: "Datos y ajustes" }).click();
  await page.getByRole("button", { name: "Ocean" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--bg"))).toBe("#0e171d");
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-theme-v1") || "{}").primary)).toBe("#267fba");

  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.style.getPropertyValue("--bg"))).toBe("#0e171d");
  await page.getByRole("button", { name: "Datos y ajustes" }).click();
  await expect(page.getByRole("button", { name: "Ocean" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Restaurar predeterminados" }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-theme-v1") || "{}").primary)).toBe("#f2b544");
});

test("shows official FTC setup guidance without breaking local mode when API credentials are absent", async ({ page }) => {
  await page.route("**/api/first/events?*", route => route.fulfill({
    status: 503,
    contentType: "application/json",
    body: JSON.stringify({ error: "FTC Events no está configurado. Configura las credenciales en el servidor." }),
  }));
  await page.getByRole("button", { name: "Eventos oficiales" }).click();
  await expect(page.getByRole("heading", { name: "Eventos oficiales" })).toBeVisible();
  await expect(page.getByText(/FTC Events no está configurado/)).toBeVisible();
  await expect(page.getByRole("link", { name: /FTC Events API de FIRST/ })).toHaveAttribute("href", "https://ftc-events.firstinspires.org/services/API");
  await page.getByRole("button", { name: "Datos y ajustes" }).click();
  await expect(page.getByRole("heading", { name: "Datos y ajustes" })).toBeVisible();
});

test("validates imports, previews without saving, detects conflicts, exports, and confirms reset", async ({ page }) => {
  await page.getByRole("button", { name: "Datos y ajustes" }).click();
  const upload = page.locator('input[type="file"]');
  await upload.setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from("{broken") });
  await expect(page.locator(".inline-message")).toContainText("El archivo no es JSON valido.");

  const incoming = { teams: [{ id: "import-team-1", number: 9876, name: "Importado E2E" }], matches: [], observations: [] };
  await upload.setInputFiles({ name: "valid.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(incoming)) });
  await expect(page.getByText("Vista previa de importación")).toBeVisible();
  let saved = await page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}").teams);
  expect(saved).toHaveLength(0);
  await page.getByRole("button", { name: "Cancelar" }).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}").teams);
  expect(saved).toHaveLength(0);

  await upload.setInputFiles({ name: "invalid-shape.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ teams: [{ id: "bad", number: 0, name: "" }], matches: [], observations: [] })) });
  await expect(page.getByText(/El equipo 1 tiene campos inválidos/)).toBeVisible();

  await upload.setInputFiles({ name: "valid.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(incoming)) });
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.getByText("Datos importados y guardados")).toBeVisible();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}").teams);
  expect(saved).toHaveLength(1);

  await upload.setInputFiles({ name: "duplicate.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(incoming)) });
  await page.getByRole("button", { name: "Confirmar importación" }).click();
  await expect(page.getByText(/Ya existe un número de equipo importado/)).toBeVisible();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}").teams);
  expect(saved).toHaveLength(1);

  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Exportar JSON/ }).click();
  const file = await download;
  const exported = JSON.parse(await readFile(await file.path(), "utf8"));
  expect(exported.teams).toHaveLength(1);
  expect(exported.teams[0].name).toBe("Importado E2E");

  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: /Borrar todos los datos/ }).click();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}").teams);
  expect(saved).toHaveLength(1);
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: /Borrar todos los datos/ }).click();
  await expect(page.getByText("Datos locales eliminados")).toBeVisible();
  saved = await page.evaluate(() => JSON.parse(localStorage.getItem("biobuzz-scout-v1") || "{}").teams);
  expect(saved).toHaveLength(0);
});
