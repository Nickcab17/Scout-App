import { expect, test } from "@playwright/test";

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

test("login and account creation remain visible at requested screen sizes", async ({ page }) => {
  await page.goto("/login");
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await expect(page.getByRole("heading", { name: "Inicia sesión para continuar" })).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.getByRole("button", { name: "Iniciar sesión" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByLabel("Nombre")).toBeVisible();
    await expect(page.getByLabel("Confirmar contraseña")).toBeVisible();
    await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeVisible();
    await page.getByRole("button", { name: "Ya tengo una cuenta" }).click();
  }
});

test("private pages and FIRST APIs reject requests without a session", async ({ page }) => {
  const apiResponse = await page.request.get("/api/first/seasons");
  expect(apiResponse.status()).toBe(401);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login\?/);
  await expect(page.getByRole("heading", { name: "Inicia sesión para continuar" })).toBeVisible();
});
