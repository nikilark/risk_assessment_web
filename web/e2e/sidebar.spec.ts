import { expect, test } from "@playwright/test";

test("sidebar collapse frees space, resizes charts/maps, persists and works on narrow screens", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const sidebar = page.locator(".sidebar");
  await expect(sidebar.locator(".brand")).toHaveCSS("cursor", "pointer");
  await expect(sidebar.locator(".sidebar-toggle")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Згорнути меню", exact: true })).toHaveAttribute("aria-expanded", "true");
  const fullWidth = (await page.locator("main").boundingBox())!.width;
  await sidebar.locator(".brand-mark").click();
  await expect(page.getByRole("button", { name: "Розгорнути меню", exact: true })).toHaveAttribute("aria-expanded", "false");
  expect((await sidebar.boundingBox())!.width).toBe(76);
  expect((await page.locator("main").boundingBox())!.width).toBeGreaterThan(fullWidth + 150);
  await expect(sidebar.locator(".nav-item span").first()).toBeHidden();
  await expect(page.getByRole("button", { name: "Проєкт", exact: true })).toHaveAttribute("title", "Проєкт");
  await page.reload();
  await expect(page.getByRole("button", { name: "Розгорнути меню", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Розгорнути меню", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(sidebar.locator(".brand strong")).toBeVisible();
  await sidebar.locator(".brand strong").click();
  await page.getByRole("button", { name: "Налаштування", exact: true }).click();
  const fixture = {
    schema_version: 1,
    project: { title: "Sidebar test", agents: [{ id: "agent-sidebar", name: "Test agent", cas: "", source: "manual", selected: true,
      dangerClass: 0, rfcLifelong: 0.05, rfcAcute: 0, sfi: 0, affectedOrgansLifelong: [], affectedOrgansAcute: [] }] },
    research: { years: [2020], points: [{ id: "point", title: "Place", population: 1000, deaths: 10, coordinate: { latitude: 50, longitude: 30 } }],
      exposures: [{ objectId: "point", agentId: "agent-sidebar", year: 2020, concentration: 0.1 }] }
  };
  await page.locator('input[type="file"]').setInputFiles({ name: "sidebar.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(fixture)) });
  await page.getByRole("button", { name: "Результати", exact: true }).click();
  const chart = page.locator(".chart-panel");
  await expect(chart.locator("canvas")).toBeAttached();
  const wideChart = (await chart.boundingBox())!.width;
  const wideMap = (await page.locator(".map-panel").boundingBox())!.width;
  await page.getByRole("button", { name: "Розгорнути меню", exact: true }).click();
  await expect(sidebar.locator(".nav-item span").first()).toBeVisible();
  expect((await chart.boundingBox())!.width).toBeLessThan(wideChart);
  expect((await page.locator(".map-panel").boundingBox())!.width).toBeLessThan(wideMap);
  await expect.poll(async () => chart.evaluate((element) => {
    const canvas = element.querySelector("canvas")!;
    return Math.abs(parseFloat(canvas.style.width) - element.clientWidth);
  })).toBeLessThan(2);
  await page.getByRole("button", { name: "Згорнути меню", exact: true }).click();
  await expect.poll(async () => (await chart.boundingBox())!.width).toBe(wideChart);

  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole("button", { name: "Розгорнути меню", exact: true }).click();
  await expect(sidebar).toHaveCSS("position", "fixed");
  await expect(page.getByRole("button", { name: "Закрити меню", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Налаштування", exact: true }).click();
  await expect(page.getByRole("button", { name: "Розгорнути меню", exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
