import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { mockMapTiles } from "./helpers/mapTiles";

test("decimal preference applies to ordinary/scientific table cells, TSV, PNG, report and saved project", async ({ page }) => {
  await mockMapTiles(page);
  await page.addInitScript(() => {
    const browser = window as unknown as { numberText: string[] }; browser.numberText = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
      browser.numberText.push(text);
      if (maxWidth === undefined) original.call(this, text, x, y); else original.call(this, text, x, y, maxWidth);
    };
  });
  const project = { schema_version: 1, project: { title: "Локаль чисел", agents: [
    { id: "locale-agent", name: "Тестова речовина", cas: "", selected: true, source: "manual", dangerClass: 0,
      rfcLifelong: 0.001234, rfcAcute: 0, sfi: 0.00001234, affectedOrgansLifelong: ["дихання"], affectedOrgansAcute: [] }
  ] }, research: { years: [2025], points: [{ id: "point", title: "Вулиця", population: 12345, deaths: 100,
    coordinate: { latitude: 47.81234, longitude: 35.12345, scale: "street" } }],
    exposures: [{ objectId: "point", agentId: "locale-agent", year: 2025, concentration: 0.012345 }] } };
  await page.goto("/");
  await page.getByRole("button", { name: "Налаштування", exact: true }).click();
  await expect(page.getByLabel("Формат чисел", { exact: true })).toHaveValue("en");
  await page.locator('input[type="file"]').setInputFiles({ name: "locale.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await page.getByRole("button", { name: "Результати", exact: true }).click();
  const table = page.locator(".result-section").filter({ has: page.locator("summary", { hasText: /^Таблиця$/ }) });
  const chart = page.locator(".result-section").filter({ has: page.locator("summary", { hasText: /^Графік$/ }) });
  const map = page.locator(".result-section").filter({ has: page.locator("summary", { hasText: "Мапа" }) });
  await table.getByRole("button", { name: "Повна", exact: true }).click();
  await expect(table.getByRole("cell", { name: "0.012345", exact: true })).toBeVisible();
  await expect(table.getByRole("cell", { name: "1.234e-3", exact: true })).toBeVisible();
  await table.getByRole("button", { name: "До звіту", exact: true }).click();
  await map.getByRole("button", { name: "До звіту", exact: true }).click();
  await page.getByRole("button", { name: "Налаштування", exact: true }).click();
  await page.getByLabel("Формат чисел", { exact: true }).selectOption("ua");
  const saveProject = page.waitForEvent("download");
  await page.getByRole("button", { name: "Зберегти JSON", exact: true }).click();
  const exported = JSON.parse(await readFile((await (await saveProject).path())!, "utf8"));
  expect(exported.settings.locale).toBe("ua");
  expect(exported.research.exposures[0].concentration).toBe(0.012345);
  await page.getByRole("button", { name: "Проєкт", exact: true }).click();
  await expect(page.locator(".agents-table")).toContainText("1,234e-5");
  await page.getByRole("button", { name: "Результати", exact: true }).click();
  await table.getByRole("button", { name: "Повна", exact: true }).click();
  await expect(table.getByRole("cell", { name: "0,012345", exact: true })).toBeVisible();
  await expect(table.getByRole("cell", { name: "1,234e-3", exact: true })).toBeVisible();
  await expect(table.getByRole("cell", { name: "10,004052", exact: true })).toBeVisible();
  const saveTable = page.waitForEvent("download");
  await table.getByRole("button", { name: "TSV", exact: true }).click();
  const tsv = await readFile((await (await saveTable).path())!, "utf8");
  expect(tsv).toContain("0,012345"); expect(tsv).toContain("1,234e-3"); expect(tsv).not.toContain("0.012345");
  await map.locator(".leaflet-interactive").first().click();
  await expect(map.locator(".leaflet-popup-content")).toContainText("10,004052");
  const saveMap = page.waitForEvent("download");
  await map.getByRole("button", { name: "PNG", exact: true }).click(); await saveMap;
  expect(await page.evaluate(() => (window as unknown as { numberText: string[] }).numberText)).toContain("10,004052");
  const canvas = chart.locator("canvas").first();
  const bounds = await canvas.boundingBox();
  await canvas.hover({ position: { x: bounds!.width / 2, y: bounds!.height / 2 } });
  await expect(chart.locator(".chart-panel")).toContainText("10,004052");
  const saveChart = page.waitForEvent("download");
  await chart.getByRole("button", { name: "PNG", exact: true }).click(); await saveChart;
  await page.getByRole("button", { name: "Звіт", exact: true }).click();
  await expect(page.locator(".report-sheet").getByRole("cell", { name: "0,012345", exact: true }).first()).toBeVisible();
  await expect(page.locator(".report-sheet")).toContainText("47,81234; 35,12345");
  await expect(page.locator(".report-asset").getByRole("cell", { name: "1,234e-3", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Роздрукувати", exact: true })).toBeEnabled();
  await page.waitForTimeout(500);
  await page.reload();
  await page.getByRole("button", { name: "Налаштування", exact: true }).click();
  await expect(page.getByLabel("Формат чисел", { exact: true })).toHaveValue("ua");
  await page.getByLabel("Формат чисел", { exact: true }).selectOption("en");
  await page.getByRole("button", { name: "Результати", exact: true }).click();
  await expect(table.getByRole("cell", { name: "0.012345", exact: true })).toBeVisible();
});
