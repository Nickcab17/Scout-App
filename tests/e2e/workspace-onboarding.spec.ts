import { expect, test } from "@playwright/test";
import { ACTIVE_WORKSPACE_STORAGE_KEY } from "../../lib/workspaces/constants";

test("workspace creation requires a session and atomically selects its Admin workspace", async ({ page }) => {
  const anonymous = await page.request.post("/api/workspaces", { data: { name: "Unauthorized" } });
  expect(anonymous.status()).toBe(401);

  const suffix = crypto.randomUUID();
  await page.goto("/login");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Onboarding Scout");
  await page.getByLabel("Correo electrónico").fill(`onboarding-${suffix}@biobuzz.test`);
  const password = `BioBuzz-${crypto.randomUUID()}!`;
  await page.getByLabel("Contraseña").fill(password);
  await page.getByLabel("Confirmar contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();

  await expect.poll(async () => (await page.request.get("/api/workspaces")).status()).toBe(200);
  const emptyList = await page.request.get("/api/workspaces");
  expect((await emptyList.json()).workspaces).toEqual([]);
  const shortName = await page.request.post("/api/workspaces", { data: { name: " " } });
  expect(shortName.status()).toBe(400);

  const name = `Onboarding ${suffix.slice(0, 8)}`;
  await page.getByLabel("Nombre del grupo").fill(name);
  await page.getByRole("button", { name: "Crear grupo" }).evaluate(button => {
    (button as HTMLButtonElement).click();
    (button as HTMLButtonElement).click();
  });
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Centro de scouting" })).toBeVisible();

  const memberships = await page.request.get("/api/workspaces");
  const membershipData = await memberships.json();
  const workspace = membershipData.workspaces[0];
  expect(workspace.name).toBe(name);
  expect(workspace.role).toBe("admin");
  expect(membershipData.workspaces).toHaveLength(1);
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), ACTIVE_WORKSPACE_STORAGE_KEY)).toBe(workspace.id);
});
