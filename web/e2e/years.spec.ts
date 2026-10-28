import { mockMapTiles } from "./helpers/mapTiles";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("edits years, compares subsets, exports a selected map year as PNG and preserves report selections", async ({ page }) => {
  const agents = [
    { id: "agent-a", name: "Речовина A", rfcLifelong: 0.05 },
    { id: "agent-b", name: "Речовина B", rfcLifelong: 0.1 }
  ].map((agent) => ({ ...agent, source: "manual", cas: "", selected: true, dangerClass: 0, rfcAcute: 0, sfi: 0,
    affectedOrgansLifelong: ["органи дихання"], affectedOrgansAcute: [] }));
  const project = {
    schema_version: 1,
    project: { title: "Порівняння років", agents },
    research: {
      years: [2020, 2021],
      points: ["Місце A", "Місце B"].map((title, index) => ({ id: `point-${index}`, title, population: 10000, deaths: 100, coordinate: { latitude: 50 + index, longitude: 30 + index } })),
      exposures: [2020, 2021].flatMap((year) => [0, 1].flatMap((point) => agents.map((agent) => ({
        objectId: `point-${point}`, agentId: agent.id, year, concentration: agent.rfcLifelong * (year === 2020 ? 2 : 4)
      }))))
    }
  };
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await mockMapTiles(page);
  await page.goto("/");
  await page.getByRole("button", { name: /Налаштування/ }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "years.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await page.getByRole("button", { name: /^Об'єкти$/ }).click();
  await expect(page.getByLabel("Рік концентрацій")).toHaveValue("2020");
  await page.getByRole("spinbutton", { name: "Місце A Речовина A", exact: true }).fill("0.2");
  await page.getByLabel("Рік концентрацій").selectOption("2021");
  await page.getByRole("spinbutton", { name: "Місце A Речовина A", exact: true }).fill("0.4");
  await page.getByLabel("Рік концентрацій").selectOption("2020");
  await expect(page.getByRole("spinbutton", { name: "Місце A Речовина A", exact: true })).toHaveValue("0.2");
  await page.getByLabel("Новий рік", { exact: true }).fill("2022");
  await page.getByRole("button", { name: "Додати рік", exact: true }).click();
  await expect(page.getByRole("spinbutton", { name: "Місце A Речовина A", exact: true })).toHaveValue("");
  await page.getByRole("button", { name: "Видалити 2022", exact: true }).click();
  await page.getByRole("button", { name: /^Результати$/ }).click();

  const table = page.locator(".result-section").filter({ has: page.locator("summary", { hasText: /^Таблиця$/ }) });
  const chart = page.locator(".result-section").filter({ has: page.locator("summary", { hasText: /^Графік$/ }) });
  const map = page.locator(".result-section").filter({ has: page.locator("summary", { hasText: "Мапа" }) });
  await expect(map.locator(".view-actions").getByRole("combobox", { name: "Рік мапи", exact: true })).toBeVisible();
  await expect(map.locator(".view-actions").getByRole("combobox", { name: "Речовина на мапі", exact: true })).toBeVisible();
  await expect(map.locator(":scope > p")).toHaveCount(0);
  await expect(table.locator("tbody tr")).toHaveCount(8);
  await expect(page.locator(".result-header h2")).toHaveCount(0);
  await expect(page.locator(".result-config-row").getByRole("combobox", { name: "Показник" })).toBeVisible();
  await expect(page.locator(".result-config-row").getByRole("group", { name: "Розрахунок" })).toBeVisible();
  await expect(page.locator(".comparison-controls").getByRole("combobox")).toHaveCount(0);
  await expect(page.getByText("Швидкий вибір", { exact: true })).toHaveCount(0);
  await expect(page.locator(".result-header").getByRole("group", { name: "Роки порівняння" })).toBeVisible();
  await expect(page.locator(".comparison-controls").getByText("Роки", { exact: true })).toHaveCount(0);
  const tableTypes = table.getByRole("group", { name: "Вигляд таблиці" });
  await expect(tableTypes.getByRole("button")).toHaveCount(2);
  await expect(tableTypes.getByRole("button", { name: "Коротка", exact: true })).toHaveAttribute("aria-pressed", "true");
  await tableTypes.getByRole("button", { name: "Повна", exact: true }).click();
  await expect(table.getByRole("columnheader", { name: "RfC", exact: true })).toBeVisible();
  await tableTypes.getByRole("button", { name: "Коротка", exact: true }).click();
  await expect(table.getByRole("columnheader", { name: "RfC", exact: true })).toHaveCount(0);
  await table.getByRole("button", { name: "До звіту", exact: true }).click();
  await page.locator(".comparison-options-objectIds").getByRole("checkbox", { name: "Місце B", exact: true }).uncheck();
  await expect(table.locator("tbody tr")).toHaveCount(4);
  const calculation = page.getByRole("group", { name: "Розрахунок", exact: true });
  await calculation.getByRole("button", { name: "Сумарно", exact: true }).click();
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await calculation.getByRole("button", { name: "Окремо", exact: true }).click();
  const years = page.getByRole("group", { name: "Роки порівняння" });
  await years.getByRole("checkbox", { name: "2021", exact: true }).uncheck();
  await expect(table.locator("tbody tr")).toHaveCount(2);
  await years.getByRole("checkbox", { name: "2021", exact: true }).check();
  await expect(table.locator("tbody tr")).toHaveCount(4);
  const chartTypes = chart.getByRole("group", { name: "Вигляд графіка" });
  await expect(chartTypes.getByRole("button")).toHaveCount(2);
  await chartTypes.getByRole("button", { name: "Тенденція", exact: true }).click();
  await expect(chartTypes.getByRole("button", { name: "Тенденція", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(chart.locator("canvas")).toBeVisible();
  await chart.getByRole("button", { name: "До звіту", exact: true }).click();
  await page.getByLabel("Рік мапи").selectOption("2020");
  await map.getByRole("button", { name: "До звіту", exact: true }).click();
  await page.getByLabel("Рік мапи").selectOption("2021");
  await map.getByRole("button", { name: "До звіту", exact: true }).click();
  const downloaded = page.waitForEvent("download");
  await expect(map.getByRole("button", { name: "GeoJSON", exact: true })).toHaveCount(0);
  await map.getByRole("button", { name: "PNG", exact: true }).click();
  const file = await downloaded;
  const png = await readFile((await file.path())!);
  expect(png.readUInt32BE(16)).toBe(1400);
  expect(file.suggestedFilename()).not.toMatch(/2020|2021|·/);
  expect(file.suggestedFilename()).toContain(" - map.png");
  await page.screenshot({ path: "/tmp/risk-years-results.png", fullPage: true });

  await page.getByRole("button", { name: /^Звіт$/ }).click();
  await expect(page.locator(".report-asset")).toHaveCount(4);
  const savedTable = page.locator(".report-asset").filter({ has: page.getByRole("heading", { name: /^Таблиця:/ }) });
  await expect(savedTable.locator("tbody tr")).toHaveCount(8);
  const savedMaps = page.locator(".report-asset").filter({ has: page.getByRole("heading", { name: /^Мапа:/ }) });
  await expect(savedMaps).toHaveCount(2);
  await expect(savedMaps.nth(0)).toContainText("HQ · Речовина A · 2020");
  await expect(savedMaps.nth(1)).toContainText("HQ · Речовина A · 2021");
  await page.emulateMedia({ media: "print" });
  await expect(savedMaps.nth(0).locator(".report-map-image")).toBeVisible();
  await expect(savedMaps.nth(1).locator(".report-map-image")).toHaveAttribute("alt", /2021/);
  await page.emulateMedia({ media: "screen" });
  await page.waitForTimeout(500);
  await page.reload();
  await page.getByRole("button", { name: /^Звіт$/ }).click();
  await expect(page.locator(".report-asset")).toHaveCount(4);
  await expect(page.locator(".report-sheet")).toContainText("Концентрації за роками");

  await page.setViewportSize({ width: 390, height: 900 });
  await page.getByRole("button", { name: /^Результати$/ }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "/tmp/risk-years-mobile.png", fullPage: true });
  expect(errors).toEqual([]);
});
