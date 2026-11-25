import { expect, test } from "@playwright/test";
import { registerAndOpenWorkspace } from "./support/local-auth";

const viewports = [
  { width: 1920, height: 1080 }, { width: 1366, height: 768 },
  { width: 1280, height: 720 }, { width: 1024, height: 768 },
  { width: 768, height: 1024 }, { width: 390, height: 844 },
];

test("authenticated private workflows render and remain usable at six resolutions", async ({ page }) => {
  await registerAndOpenWorkspace(page);
  const workflows = [
    ["Pit Scouting", "Pit Scouting"],
    ["Match Scouting", "Scouting de partido"],
    ["Alliance Selection", "Selección de alianza"],
    ["Analytics", "Analítica"],
    ["FIRST Events", "FIRST Events"],
    ["Datos y ajustes", "Cuenta y espacio de trabajo"],
  ] as const;

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    for (const [navigation, heading] of workflows) {
      await page.getByRole("button", { name: navigation, exact: true }).click();
      await expect(page.getByRole("heading", { name: heading, exact: false }).first()).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
      const clippedControls = await page.locator("button:visible, input:visible, select:visible, textarea:visible").evaluateAll((nodes, width) =>
        nodes.filter(node => {
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && (rect.left < -1 || rect.right > Number(width) + 1);
        }).map(node => (node as HTMLElement).innerText || (node as HTMLInputElement).ariaLabel || node.tagName), viewport.width,
      );
      expect(clippedControls, `${navigation} controls outside ${viewport.width}px viewport`).toEqual([]);
      const overlappingControls = await page.locator("button:visible, input:visible, select:visible, textarea:visible").evaluateAll(nodes => {
        const rects = nodes.map(node => {
          const rect = node.getBoundingClientRect();
          return { name: (node as HTMLElement).innerText.trim() || (node as HTMLInputElement).ariaLabel || node.tagName, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
        }).filter(rect => rect.right > rect.left && rect.bottom > rect.top);
        const overlaps: string[] = [];
        for (let first = 0; first < rects.length; first++) for (let second = first + 1; second < rects.length; second++) {
          const a = rects[first]; const b = rects[second];
          const intersects = Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
          const nested = (a.left <= b.left && a.right >= b.right && a.top <= b.top && a.bottom >= b.bottom)
            || (b.left <= a.left && b.right >= a.right && b.top <= a.top && b.bottom >= a.bottom);
          if (intersects && !nested) overlaps.push(`${a.name} ↔ ${b.name}`);
        }
        return overlaps;
      });
      expect(overlappingControls, `${navigation} controls overlap at ${viewport.width}px`).toEqual([]);
    }
  }
});
