import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("charts have headings and tendency PNG includes every legend entry", async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.addInitScript(() => {
    const browser = window as unknown as { chartText: { text: string; x: number; y: number; width: number; height: number }[] };
    browser.chartText = [];
    const draw = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
      const matrix = this.getTransform();
      browser.chartText.push({ text, x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f,
        width: this.canvas.width, height: this.canvas.height });
      if (maxWidth === undefined) draw.call(this, text, x, y); else draw.call(this, text, x, y, maxWidth);
    };
  });
  const agent = { id: "agent", name: "Азоту діоксид", source: "manual", selected: true, cas: "", dangerClass: 0,
    rfcLifelong: 0.05, rfcAcute: 0, sfi: 0, affectedOrgansLifelong: [], affectedOrgansAcute: [] };
  const points = Array.from({ length: 18 }, (_, index) => ({ id: `point-${index}`, title: `Вулиця ${index + 1} — довга назва перехрестя біля торгового центру`, population: 1000, deaths: 10 }));
  const project = { schema_version: 1, project: { title: "Експорт графіка", agents: [agent] }, research: { years: [2020, 2021, 2022], points,
    exposures: [2020, 2021, 2022].flatMap(year => points.map((point, index) => ({ objectId: point.id, agentId: agent.id, year, concentration: (index + 1) * 0.01 * (year - 2019) }))) } };
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Налаштування", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "chart.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await page.getByRole("button", { name: "Результати", exact: true }).click();
  const section = page.locator(".result-section").filter({ has: page.locator("summary", { hasText: /^Графік$/ }) });
  const chart = section.locator(".chart-panel");
  await expect(chart).toHaveAttribute("aria-label", /Хронічний неканцерогенний ризик.*HQ.*2020, 2021, 2022/);
  await section.getByRole("button", { name: "Тенденція", exact: true }).click();
  await expect(chart).toHaveClass(/chart-panel-tendency/);
  await chart.scrollIntoViewIfNeeded();
  await chart.screenshot({ path: "/tmp/risk-tendency-legend.png" });
  await page.evaluate(() => { (window as unknown as { chartText: unknown[] }).chartText = []; });
  const saving = page.waitForEvent("download");
  await section.getByRole("button", { name: "PNG", exact: true }).click();
  const download = await saving;
  await download.saveAs("/tmp/risk-chart-export.png");
  const drawn = await page.evaluate(() => (window as unknown as { chartText: { text: string; x: number; y: number; width: number; height: number }[] }).chartText.filter(item => item.width === 2400));
  const text = drawn.map(item => item.text).join(" ");
  expect(text).toContain("Хронічний неканцерогенний ризик");
  expect(text).toContain("Роки: 2020, 2021, 2022");
  for (let index = 1; index <= 18; index++) expect(text).toContain(`Вулиця ${index} `);
  expect(drawn.every(item => item.y >= 0 && item.y < item.height)).toBe(true);
  const png = await readFile((await download.path())!);
  expect(png.readUInt32BE(16)).toBe(2400);
  expect(png.readUInt32BE(20)).toBeGreaterThan(1200);
  await page.setViewportSize({ width: 390, height: 900 });
  if (await page.getByRole("button", { name: "Згорнути меню", exact: true }).isVisible()) await page.getByRole("button", { name: "Згорнути меню", exact: true }).click();
  await expect(chart).toBeVisible();
  await expect.poll(async () => (await chart.boundingBox())?.width ?? 0).toBeGreaterThan(200);
  await chart.screenshot({ path: "/tmp/risk-tendency-legend-mobile.png" });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1600, height: 1000 });
  const choices = page.locator(".comparison-options-objectIds").getByRole("checkbox");
  for (let index = 1; index < 18; index++) await choices.nth(index).uncheck();
  await expect(chart).toHaveAttribute("aria-label", /Вулиця 1.*Азоту діоксид/);
  await page.evaluate(() => { (window as unknown as { chartText: unknown[] }).chartText = []; });
  const singleDownload = page.waitForEvent("download");
  await section.getByRole("button", { name: "PNG", exact: true }).click();
  await singleDownload;
  const singleText = await page.evaluate(() => (window as unknown as { chartText: { text: string; width: number }[] }).chartText.filter(item => item.width === 2400).map(item => item.text).join(" "));
  expect(singleText).toContain("Вулиця 1");
  expect(singleText).toContain("Азоту діоксид");
  expect(errors).toEqual([]);
});
