import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mockMapTiles } from "./helpers/mapTiles";

async function openProject(page: Page) {
  await page.addInitScript(() => {
    const browser = window as unknown as { mapText: { text: string; x: number; y: number; middle: boolean }[] };
    browser.mapText = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
      if (this.canvas.width === 1400) browser.mapText.push({ text, x, y, middle: this.textBaseline === "middle" });
      if (maxWidth === undefined) original.call(this, text, x, y); else original.call(this, text, x, y, maxWidth);
    };
  });
  const project = { schema_version: 1,
    project: { title: "Експорт мапи", agents: [{ id: "agent", name: "Азоту діоксид", selected: true, source: "manual", cas: "", dangerClass: 0,
      rfcLifelong: 0.05, rfcAcute: 0, sfi: 0, affectedOrgansLifelong: [], affectedOrgansAcute: [] }] },
    research: { years: [2025], points: Array.from({ length: 11 }, (_, i) => ({ id: `point-${i}`, title: `Перехрестя ${i + 1}: дуже довга назва вулиці біля торгового центру та зупинки громадського транспорту`, population: 0, deaths: 0,
      coordinate: { latitude: 47.83, longitude: 35.13, scale: "street" } })),
    exposures: Array.from({ length: 11 }, (_, i) => ({ objectId: `point-${i}`, agentId: "agent", year: 2025, concentration: (i + 1) * 0.05 })) } };
  await page.goto("/");
  await page.getByRole("button", { name: "Налаштування", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "map.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await page.getByRole("button", { name: "Результати", exact: true }).click();
  return page.locator(".result-section").filter({ has: page.locator("summary", { hasText: "Мапа" }) });
}

test("PNG contains basemap, title, year, risk legend and separate keys without overlapping markers", async ({ page }) => {
  await mockMapTiles(page);
  const map = await openProject(page);
  await expect(map.getByRole("button", { name: "GeoJSON", exact: true })).toHaveCount(0);
  const saving = page.waitForEvent("download");
  await map.getByRole("button", { name: "PNG", exact: true }).click();
  const download = await saving;
  await download.saveAs("/tmp/risk-map-export-fixed.png");
  const png = await readFile((await download.path())!);
  const image = await page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
    const pixels = context.getImageData(48, 220, 1304, 580).data;
    let mapPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] === 228 && pixels[i + 1] === 236 && pixels[i + 2] === 220) mapPixels++;
    return { mapPixels, width: image.width, height: image.height };
  }, png.toString("base64"));
  expect(image.width).toBe(1400); expect(image.height).toBeGreaterThan(1300);
  expect(image.mapPixels).toBeGreaterThan(100000);
  const drawn = await page.evaluate(() => (window as unknown as { mapText: { text: string; x: number; y: number; middle: boolean }[] }).mapText);
  const text = drawn.map(item => item.text).join(" ");
  expect(text).toContain("Хронічний неканцерогенний ризик");
  expect(text).toContain("HQ · Азоту діоксид · 2025");
  expect(text).toContain("Критичний");
  expect(text).toContain("OpenStreetMap");
  for (let i = 1; i <= 11; i++) expect(text).toContain(`Перехрестя ${i}:`);
  const badges = drawn.filter(item => item.middle);
  expect(badges).toHaveLength(11);
  badges.forEach((badge, i) => badges.slice(i + 1).forEach(other => expect(Math.hypot(badge.x - other.x, badge.y - other.y)).toBeGreaterThanOrEqual(41.9)));
  await map.getByRole("button", { name: "До звіту", exact: true }).click();
  await page.getByRole("button", { name: "Звіт", exact: true }).click();
  await expect(page.getByRole("button", { name: "Роздрукувати", exact: true })).toBeEnabled();
  await page.emulateMedia({ media: "print" });
  const printed = page.locator(".report-map-image");
  await expect(printed).toBeVisible();
  expect(await printed.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBe(1400);
});

test("failed map tiles show an error and allow retry instead of downloading a blank map", async ({ page }) => {
  await mockMapTiles(page);
  let fail = true;
  await page.route(/https:\/\/tile\.openstreetmap\.org\//, async route => {
    if (fail) await route.abort(); else await route.fallback();
  });
  const map = await openProject(page);
  let downloads = 0; page.on("download", () => { downloads++; });
  await map.getByRole("button", { name: "PNG", exact: true }).click();
  await expect(page.locator(".action-note")).toContainText("Не вдалося завантажити підкладку мапи");
  expect(downloads).toBe(0);
  await expect(map.getByRole("button", { name: "PNG", exact: true })).toBeEnabled();
  fail = false;
  const saving = page.waitForEvent("download");
  await map.getByRole("button", { name: "PNG", exact: true }).click();
  await saving;
  expect(downloads).toBe(1);
  fail = true;
  await map.getByRole("button", { name: "До звіту", exact: true }).click();
  await page.getByRole("button", { name: "Звіт", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Не вдалося завантажити підкладку мапи");
  await expect(page.getByRole("button", { name: "Роздрукувати", exact: true })).toBeDisabled();
  fail = false;
  await page.getByRole("button", { name: "Повторити", exact: true }).click();
  await expect(page.getByRole("button", { name: "Роздрукувати", exact: true })).toBeEnabled();
});
