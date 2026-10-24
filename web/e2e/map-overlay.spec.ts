import { expect, test, type Page } from "@playwright/test";

async function openMap(page: Page) {
  const agent = { id: "test", name: "Тестова речовина", source: "manual", cas: "", selected: true,
    dangerClass: 0, rfcLifelong: 0.05, rfcAcute: 0, sfi: 0,
    affectedOrgansLifelong: [], affectedOrgansAcute: [] };
  const project = { schema_version: 1, project: { title: "Мапа", agents: [agent] }, research: {
    years: [2020, 2021], points: [{ id: "point", title: "Місце", population: 0, deaths: 0,
      coordinate: { latitude: 50, longitude: 30, scale: "street" } }],
    exposures: [2020, 2021].map(year => ({ objectId: "point", agentId: "test", year, concentration: 0.1 }))
  } };
  await page.goto("/");
  await page.getByRole("button", { name: /Налаштування/ }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "map.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await page.getByRole("button", { name: /^Результати$/ }).click();
  return page.locator(".map-panel");
}

const sources = { elements: [{ type: "node", id: 123, lat: 50, lon: 30, tags: { man_made: "works", name: "Джерело" } }] };

test("source errors have retry, successful results survive changing year, checkbox aligns with its label", async ({ page }) => {
  let requests = 0;
  await page.route("https://overpass-api.de/api/interpreter", async route => {
    requests++;
    if (requests === 1) await route.fulfill({ json: { elements: [], remark: "runtime error: timeout" } });
    else if (requests === 2) await route.fulfill({ status: 429, body: "Too many requests" });
    else await route.fulfill({ json: sources });
  });
  const map = await openMap(page);
  const checkbox = map.getByRole("checkbox", { name: "Джерела забруднення" });
  await checkbox.check();
  await expect(map.getByRole("status")).toContainText("Сервіс не завершив пошук");
  await map.getByRole("button", { name: "Повторити", exact: true }).click();
  await expect(map.getByRole("status")).toContainText("Сервіс обмежив запити");
  await map.getByRole("button", { name: "Повторити", exact: true }).click();
  await expect(map.locator(".pollution-source-leaflet-icon")).toHaveCount(1);
  await expect(map.getByRole("button", { name: "Повторити", exact: true })).toBeHidden();
  const centers = await map.locator(".pollution-source-toggle").evaluate(label => Array.from(label.children).map(child => {
    const rect = child.getBoundingClientRect(); return rect.y + rect.height / 2;
  }));
  expect(Math.abs(centers[0] - centers[1])).toBeLessThan(1);
  await page.getByLabel("Рік мапи", { exact: true }).selectOption("2021");
  await expect(checkbox).toBeChecked();
  await expect(map.locator(".pollution-source-leaflet-icon")).toHaveCount(1);
  expect(requests).toBe(3);
  await expect(map.locator(".map-legend-control strong")).toHaveText("Рівень ризику");
});

test("unchecking cancels a pending search without reporting an error", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("https://overpass-api.de/api/interpreter", async route => { await pending; await route.fulfill({ json: sources }).catch(() => {}); });
  const map = await openMap(page);
  const checkbox = map.getByRole("checkbox", { name: "Джерела забруднення" });
  await checkbox.check();
  await expect(map.getByRole("status")).toHaveText("Пошук…");
  await checkbox.uncheck();
  release();
  await expect(map.locator(".pollution-source-control small")).toBeHidden();
  await expect(map.locator(".pollution-source-leaflet-icon")).toHaveCount(0);
  await expect(map.getByRole("button", { name: "Повторити", exact: true })).toBeHidden();
});

test("offline and wide-area views explain why source searches are unavailable", async ({ page, context }) => {
  let requests = 0;
  await page.route("https://overpass-api.de/api/interpreter", async route => { requests++; await route.fulfill({ json: sources }); });
  const map = await openMap(page);
  const checkbox = map.getByRole("checkbox", { name: "Джерела забруднення" });
  await context.setOffline(true);
  await expect(checkbox).toBeDisabled();
  await expect(map.getByRole("status")).toContainText("Потрібне з’єднання");
  await context.setOffline(false);
  await expect(checkbox).toBeEnabled();
  for (let i = 0; i < 4; i++) {
    await map.getByRole("button", { name: "Zoom out", exact: true }).click();
    await page.waitForTimeout(400);
  }
  await expect(checkbox).toBeDisabled();
  await expect(map.getByRole("status")).toContainText("Наблизьте мапу");
  expect(requests).toBe(0);
});

test("a stalled service times out and offers retry", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("https://overpass-api.de/api/interpreter", async route => { await pending; await route.fulfill({ json: sources }).catch(() => {}); });
  const map = await openMap(page);
  await page.clock.install();
  await map.getByRole("checkbox", { name: "Джерела забруднення" }).check();
  await expect(map.getByRole("status")).toHaveText("Пошук…");
  await page.clock.runFor(30100);
  await expect(map.getByRole("status")).toContainText("Сервіс не відповів за 30 секунд");
  await expect(map.getByRole("button", { name: "Повторити", exact: true })).toBeVisible();
  release();
});

test("source layer keeps facilities and landfills while excluding broad zones and individual equipment", async ({ page }) => {
  let query = "";
  const facilities = [
    { man_made: "works", name: "Завод" },
    { landuse: "landfill", name: "Полігон" },
    { power: "plant", "plant:source": "gas;biomass", name: "ТЕЦ" },
    { man_made: "wastewater_plant", name: "Очисні споруди" },
    { amenity: "waste_transfer_station", name: "Перевантажувальна станція" }
  ];
  const clutter = [
    { landuse: "industrial", name: "Промислова зона" },
    { man_made: "chimney", name: "Димова труба" },
    { industrial: "warehouse", name: "Склад" },
    { power: "generator", "generator:source": "diesel", name: "Генератор" },
    { power: "plant", "plant:source": "solar", name: "Сонячна станція" },
    { amenity: "recycling", recycling_type: "container", name: "Контейнер" }
  ];
  await page.route("https://overpass-api.de/api/interpreter", async route => {
    query = route.request().postData() ?? "";
    await route.fulfill({ json: { elements: [...facilities, ...clutter].map((tags, index) => ({
      type: "node", id: index, lat: 50, lon: 30 + (index - 2) * 0.003, tags
    })) } });
  });
  const map = await openMap(page);
  await map.getByRole("checkbox", { name: "Джерела забруднення" }).check();
  await expect(map.locator(".pollution-source-leaflet-icon")).toHaveCount(5);
  await expect(map.getByRole("status")).toHaveText("5");
  for (const tags of facilities) await expect(map.getByTitle(tags.name, { exact: true })).toBeVisible();
  for (const tags of clutter) await expect(map.getByTitle(tags.name, { exact: true })).toHaveCount(0);
  expect(query).toContain('["landuse"="landfill"]');
  expect(query).not.toMatch(/industrial|chimney|generator/);
  await map.getByTitle("Полігон", { exact: true }).click();
  await expect(map.locator(".leaflet-popup-content")).toContainText("полігон відходів");
});
