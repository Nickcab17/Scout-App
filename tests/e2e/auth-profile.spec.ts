import { expect, test } from "@playwright/test";
import { registerAndOpenWorkspace } from "./support/local-auth";

test("real local registration, profile update, logout, and password login", async ({ page }) => {
  const credentials = await registerAndOpenWorkspace(page);
  await page.getByRole("button", { name: "Datos y ajustes" }).click();
  await expect(page.getByRole("heading", { name: "Mi perfil" })).toBeVisible();
  await expect(page.getByText("admin", { exact: true })).toBeVisible();
  await page.getByLabel("Nombre", { exact: true }).last().fill("E2E Profile Updated");
  await page.getByRole("button", { name: "Guardar perfil" }).click();
  await expect(page.getByRole("status")).toContainText("Perfil actualizado");
  await page.reload();
  await page.getByRole("button", { name: "Datos y ajustes" }).click();
  await expect(page.getByLabel("Nombre", { exact: true }).last()).toHaveValue("E2E Profile Updated");

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByLabel("Correo electrónico").fill(credentials.email);
  await page.getByLabel("Contraseña").fill(credentials.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("button", { name: "Datos y ajustes" }).click();
  await expect(page.getByRole("heading", { name: "Mi perfil" })).toBeVisible();

  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
  await page.getByRole("button", { name: "¿Olvidaste tu contraseña?" }).click();
  await page.getByLabel("Correo electrónico").fill(credentials.email);
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await expect(page.getByRole("status")).toContainText("Revisa tu correo");

  const mailpit = "http://127.0.0.1:54324/api/v1";
  await expect.poll(async () => {
    const response = await page.request.get(`${mailpit}/search?query=${encodeURIComponent(credentials.email)}`);
    if (!response.ok()) return 0;
    return ((await response.json()).messages as unknown[] | undefined)?.length ?? 0;
  }).toBeGreaterThan(0);
  const search = await page.request.get(`${mailpit}/search?query=${encodeURIComponent(credentials.email)}`);
  const messageId = (await search.json()).messages[0].ID as string;
  const mail = await page.request.get(`${mailpit}/message/${encodeURIComponent(messageId)}`);
  const html = String((await mail.json()).HTML ?? "").replace(/&amp;/g, "&");
  const recoveryLink = html.match(/https?:\/\/[^\s"'<>]+/)?.[0];
  expect(recoveryLink, "Supabase Auth should email a recovery link to the local Mailpit inbox").toBeTruthy();
  await page.goto(recoveryLink!);
  await expect(page.getByRole("heading", { name: "Crear contraseña nueva" })).toBeVisible();
  const recoveredPassword = `Recovered-${crypto.randomUUID()}!`;
  await page.getByLabel("Contraseña nueva").fill(recoveredPassword);
  await page.getByLabel("Confirmar contraseña").fill(recoveredPassword);
  await page.getByRole("button", { name: "Actualizar contraseña" }).click();
  await expect(page.getByRole("status")).toContainText("Contraseña actualizada");

  await page.goto("/login");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.getByLabel("Correo electrónico").fill(credentials.email);
  await page.getByLabel("Contraseña").fill(recoveredPassword);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await page.getByRole("button", { name: "Datos y ajustes" }).click();
  await expect(page.getByRole("heading", { name: "Mi perfil" })).toBeVisible();
});
