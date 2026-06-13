import { stat } from "node:fs/promises";
import { expect, test } from "@playwright/test";

test("project page fits mobile width", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto("/");

  await expect(page.locator(".title-input")).toHaveValue("Нове дослідження");
  await expect(page.locator(".organ-legend")).toContainText("Легенда іконок органів");
  const viewport = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(viewport.scrollWidth).toBe(viewport.clientWidth);
});

test("main research flow renders map, chart, and typed report assets", async ({ page }) => {
  const overpassRequests: string[] = [];
  await page.route("https://overpass-api.de/api/interpreter", async (route) => {
    const postData = route.request().postData() ?? "";
    overpassRequests.push(postData);
    const bbox = postData.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
    const south = Number(bbox?.[1] ?? 49);
    const west = Number(bbox?.[2] ?? 31);
    const north = Number(bbox?.[3] ?? 50);
    const east = Number(bbox?.[4] ?? 32);
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        elements: [
          {
            type: "node",
            id: 1,
            lat: (south + north) / 2,
            lon: (west + east) / 2,
            tags: { man_made: "works", name: "Visible test source" }
          },
          {
            type: "node",
            id: 2,
            lat: north + 2,
            lon: east + 2,
            tags: { man_made: "chimney", name: "Outside test source" }
          }
        ]
      })
    });
  });
  await page.goto("/");

  await page.locator(".agents-table tbody input[type='checkbox']").first().check();
  const objectsButton = page.getByRole("button", { name: /^Об'єкти$/ });
  await expect(objectsButton).toBeEnabled();
  await expect(objectsButton).toHaveClass(/newly-available/);

  await objectsButton.click();
  await page.getByRole("button", { name: /Обрати на мапі/ }).click();
  await expect(page.locator(".map-picker")).toBeVisible();
  await expect(page.locator(".map-picker .pollution-source-control")).toContainText("Джерела забруднення");
  await page.locator(".map-picker").click({ position: { x: 300, y: 180 } });
  await expect(page.locator(".coordinate-box")).toContainText("регіон");

  const marker = page.locator(".leaflet-marker-icon").first();
  await expect(marker).toBeVisible();
  await expect(marker).toHaveJSProperty("complete", true);

  const objectName = page.getByLabel("Назва об'єкта");
  await expect(objectName).not.toHaveValue("");
  await page.getByRole("button", { name: /^Додати$/ }).click();

  await page.locator(".exposure-table tbody input.cell-input").first().fill("1");
  const resultsButton = page.getByRole("button", { name: /Результати/ });
  await expect(resultsButton).toBeEnabled();
  await resultsButton.click();

  const chartSection = page.locator(".result-section", { hasText: "Графік" });
  const chartCanvas = page.locator(".chart-panel canvas").first();
  await expect(chartCanvas).toBeVisible();
  const chartPixels = await chartCanvas.evaluate((canvas) => {
    const context = canvas.getContext("2d");
    if (!context) return 0;
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let nonBlank = 0;
    for (let index = 0; index < data.length; index += 4) {
      if (!(data[index] > 245 && data[index + 1] > 245 && data[index + 2] > 245 && data[index + 3] > 245)) {
        nonBlank += 1;
      }
    }
    return nonBlank;
  });
  expect(chartPixels).toBeGreaterThan(500);
  await chartSection.getByRole("button", { name: /До звіту/ }).click();
  await expect(page.locator(".action-note")).toContainText("Графік:");

  const mapSection = page.locator(".result-section", { hasText: "Мапа" });
  await expect(page.locator(".map-panel .leaflet-interactive").first()).toBeVisible();
  await expect(mapSection.locator(".pollution-source-control")).toContainText("Джерела забруднення");
  await mapSection.locator(".pollution-source-control input").check();
  await expect(mapSection.locator(".pollution-source-control small")).toContainText("1");
  await expect(mapSection.locator(".pollution-source-leaflet-icon")).toHaveCount(1);
  expect(overpassRequests.length).toBeGreaterThan(0);
  const requestedBbox = overpassRequests[0].match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
  expect(Number(requestedBbox?.[1])).toBeLessThan(Number(requestedBbox?.[3]));
  expect(Number(requestedBbox?.[2])).toBeLessThan(Number(requestedBbox?.[4]));
  await expect(mapSection.locator(".map-legend-control")).toContainText("Рівень ризику");
  await expect(mapSection.locator(".map-legend-control")).not.toContainText("Масштаб об'єкта");
  const mapDownload = page.waitForEvent("download");
  await mapSection.getByRole("button", { name: /^PNG$/ }).click();
  const downloadedMap = await mapDownload;
  expect(downloadedMap.suggestedFilename()).toMatch(/_map\.png$/);
  const downloadedMapPath = await downloadedMap.path();
  expect(downloadedMapPath).toBeTruthy();
  if (downloadedMapPath) expect((await stat(downloadedMapPath)).size).toBeGreaterThan(1000);
  await mapSection.getByRole("button", { name: /До звіту/ }).click();
  await expect(page.locator(".action-note")).toContainText("Мапа:");

  await page.getByRole("button", { name: /Звіт/ }).click();
  await expect(page.locator(".report-sheet")).toContainText("Графік:");
  await expect(page.locator(".report-sheet")).toContainText("Мапа:");
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await expect(page.locator(".report-sheet .chart-panel").first()).toHaveCSS("background-color", "rgb(255, 253, 248)");
});

test("results are blocked when active research type has no valid exposure", async ({ page }) => {
  await page.goto("/");

  await page.locator(".agents-table tbody input[type='checkbox']").first().check();
  await page.getByRole("button", { name: /^Об'єкти$/ }).click();
  await page.getByLabel("Назва об'єкта").fill("Тестовий об'єкт");
  await page.getByRole("button", { name: /^Додати$/ }).click();
  await page.locator(".exposure-table tbody input.cell-input").first().fill("1");
  await expect(page.getByRole("button", { name: /Результати/ })).toBeEnabled();

  await page.getByRole("button", { name: /Проєкт/ }).click();
  await page.locator(".switch-card", { hasText: "Неканцерогенний ризик" }).locator("input.toggle-input").first().uncheck();
  await page.locator(".switch-card", { hasText: "Зважені частинки" }).locator("input.toggle-input").check();

  await expect(page.getByRole("button", { name: /Результати/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Звіт/ })).toBeDisabled();
});
