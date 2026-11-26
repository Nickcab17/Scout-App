import { expect, test } from "@playwright/test";
import { registerAndOpenWorkspace } from "./support/local-auth";

test("regional checkboxes group by official week and persist multiple group selections", async ({ page }) => {
  await registerAndOpenWorkspace(page);
  await page.route("**/api/first/seasons", route => route.fulfill({ json: { currentSeason: 2026, maxSeason: 2026 } }));
  await page.route(/\/api\/first\/events\?season=2026(?:&.*)?$/, route => route.fulfill({ json: {
    events: [
      { eventId: 1, code: "KICK26", name: "FTC Kickoff", dateStart: "2026-09-12", dateEnd: "2026-09-12" },
      { eventId: 2, code: "REG126", name: "Regional One", dateStart: "2026-09-18", dateEnd: "2026-09-19" },
      { eventId: 3, code: "REG226", name: "Regional Two", dateStart: "2026-09-25", dateEnd: "2026-09-26" },
    ],
    pageTotal: 1,
    syncedAt: new Date().toISOString(),
    persisted: false,
  } }));

  await page.getByRole("button", { name: "FIRST Events" }).click();
  const weekOne = page.locator("details.official-event-week").filter({ has: page.getByText("Semana 1", { exact: true }) });
  const weekTwo = page.locator("details.official-event-week").filter({ has: page.getByText("Semana 2", { exact: true }) });
  const regionalOne = page.getByRole("checkbox", { name: "Seleccionar Regional One" });
  const regionalTwo = page.getByRole("checkbox", { name: "Seleccionar Regional Two" });
  await expect(weekOne).toContainText("Regional One");
  await expect(weekTwo).toContainText("Regional Two");
  await weekTwo.locator("summary").click();
  await regionalOne.check();
  await regionalTwo.check();
  await expect(regionalOne).toBeChecked();
  await expect(regionalTwo).toBeChecked();

  const workspaceResponse = await page.request.get("/api/workspaces");
  const workspaceId = (await workspaceResponse.json()).workspaces[0].id as string;
  const savedResponse = await page.request.get(`/api/first/selection/events?workspaceId=${workspaceId}&season=2026`);
  expect(savedResponse.ok()).toBeTruthy();
  expect((await savedResponse.json()).eventCodes).toEqual(["REG126", "REG226"]);

  await page.reload();
  await page.getByRole("button", { name: "FIRST Events" }).click();
  await expect(page.getByRole("checkbox", { name: "Seleccionar Regional One" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "Seleccionar Regional Two" })).toBeChecked();
});
