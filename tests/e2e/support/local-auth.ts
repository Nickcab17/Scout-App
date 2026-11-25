import type { Page } from "@playwright/test";

export async function registerAndOpenWorkspace(page: Page) {
  const suffix = crypto.randomUUID();
  const email = `e2e-${suffix}@biobuzz.test`;
  const workspace = `E2E ${suffix.slice(0, 8)}`;
  const password = `BioBuzz-${crypto.randomUUID()}!`;

  await page.goto("/login");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("E2E Scout");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByLabel("Confirmar contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();

  await page.getByLabel("Nombre del grupo").fill(workspace);
  await page.getByRole("button", { name: "Crear grupo" }).click();
  await page.getByRole("button", { name: "Abrir" }).click();
  await page.getByRole("heading", { name: "Centro de scouting" }).waitFor();
  return { email, password, workspace };
}
