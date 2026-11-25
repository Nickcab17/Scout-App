import { expect, test, type Browser, type Page } from "@playwright/test";
import { registerAndOpenWorkspace } from "./support/local-auth";

async function createInvite(page: Page, email: string, role: "scout" | "viewer") {
  await page.getByRole("button", { name: "Datos y ajustes" }).click();
  await page.getByLabel("Correo de invitación").fill(email);
  await page.locator(".workspace-panel form select").first().selectOption(role);
  await page.getByRole("button", { name: "Crear invitación" }).click();
  await expect(page.locator(".workspace-panel code")).toBeVisible();
  return page.locator(".workspace-panel code").innerText();
}

async function acceptInvite(browser: Browser, email: string, token: string) {
  const context = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Role E2E");
  await page.getByLabel("Correo electrónico").fill(email);
  const password = `BioBuzz-${crypto.randomUUID()}!`;
  await page.getByLabel("Contraseña").fill(password);
  await page.getByLabel("Confirmar contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await page.getByLabel("Código de invitación").fill(token);
  await page.getByRole("button", { name: "Aceptar invitación" }).click();
  await expect(page.getByRole("status")).toContainText("Invitación aceptada");
  const memberships = await page.request.get("/api/workspaces");
  const result = await memberships.json();
  const workspaceId = result.workspaces?.[0]?.id as string;
  expect(workspaceId).toBeTruthy();
  return { context, page, workspaceId };
}

test("Admin, Scout, and read-only roles enforce workspace write permissions", async ({ page, browser }) => {
  await registerAndOpenWorkspace(page);
  const workspacesResponse = await page.request.get("/api/workspaces");
  const workspaces = await workspacesResponse.json();
  const workspaceId = workspaces.workspaces[0].id as string;
  expect(workspaces.workspaces[0].role).toBe("admin");
  const emptyData = { teams: [], matches: [], observations: [] };
  const adminWrite = await page.request.put(`/api/workspaces/${workspaceId}/scouting`, { data: { data: emptyData } });
  expect(adminWrite.status()).toBe(200);

  const scoutEmail = `scout-${crypto.randomUUID()}@biobuzz.test`;
  const scoutToken = await createInvite(page, scoutEmail, "scout");
  const scout = await acceptInvite(browser, scoutEmail, scoutToken);
  const scoutWrite = await scout.page.request.put(`/api/workspaces/${workspaceId}/scouting`, { data: { data: emptyData } });
  expect(scoutWrite.status()).toBe(200);

  const viewerEmail = `viewer-${crypto.randomUUID()}@biobuzz.test`;
  const viewerToken = await createInvite(page, viewerEmail, "viewer");
  const viewer = await acceptInvite(browser, viewerEmail, viewerToken);
  const read = await viewer.page.request.get(`/api/workspaces/${workspaceId}/scouting`);
  expect(read.status()).toBe(200);
  const viewerWrite = await viewer.page.request.put(`/api/workspaces/${workspaceId}/scouting`, { data: { data: emptyData } });
  expect(viewerWrite.status()).toBe(403);

  const outsiderContext = await browser.newContext({ baseURL: "http://127.0.0.1:3100" });
  const outsider = await outsiderContext.newPage();
  await outsider.goto("/login");
  await outsider.getByRole("button", { name: "Crear cuenta" }).click();
  await outsider.getByLabel("Nombre", { exact: true }).fill("Outsider E2E");
  await outsider.getByLabel("Correo electrónico").fill(`outside-${crypto.randomUUID()}@biobuzz.test`);
  const outsiderPassword = `BioBuzz-${crypto.randomUUID()}!`;
  await outsider.getByLabel("Contraseña").fill(outsiderPassword);
  await outsider.getByLabel("Confirmar contraseña").fill(outsiderPassword);
  await outsider.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  const forbidden = await outsider.request.get(`/api/workspaces/${workspaceId}/scouting`);
  expect(forbidden.status()).toBe(403);
  await scout.context.close();
  await viewer.context.close();
  await outsiderContext.close();
});
