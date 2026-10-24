import { expect, test } from "@playwright/test";

test("cancer tables and map legends use four levels while non-cancer retains five", async ({ page }) => {
  const project = {
    schema_version: 1,
    project: {
      title: "Calculation regression",
      research_type: { cancer_lifelong: true, non_cancer_lifelong: true },
      agents: [{ id: "agent-test", name: "Test agent", cas: "", source: "manual", selected: true,
        dangerClass: 0, rfcLifelong: 0.01, rfcAcute: 0, sfi: 10,
        affectedOrgansLifelong: ["органи дихання"], affectedOrgansAcute: [] }]
    },
    research: { years: [2020], points: [{ id: "point", title: "Place", population: 50000, deaths: 100,
      coordinate: { latitude: 50, longitude: 30 } }],
      exposures: [{ objectId: "point", agentId: "agent-test", year: 2020, concentration: 1 }] }
  };
  await page.goto("/");
  await page.getByRole("button", { name: /Налаштування/ }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "calculations.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await page.getByRole("button", { name: "Результати", exact: true }).click();
  const table = page.locator(".result-section").filter({ has: page.locator("summary", { hasText: /^Таблиця$/ }) });
  await expect(table).toContainText("3,2407045");
  await expect(table).toContainText("Високий");
  await expect(table).not.toContainText("Критичний");
  await expect(page.locator(".map-legend-list > span")).toHaveCount(4);
  await expect(page.locator(".map-legend-control")).not.toContainText("Критичний");
  await table.getByRole("button", { name: "До звіту", exact: true }).click();
  await page.getByLabel("Показник", { exact: true }).selectOption("non_cancer_lifelong");
  await expect(table).toContainText("Критичний");
  await expect(page.locator(".map-legend-list > span")).toHaveCount(5);
  await page.getByRole("button", { name: "Звіт", exact: true }).click();
  await expect(page.locator(".report-asset")).toContainText("3,2407045");
  await expect(page.locator(".report-asset")).not.toContainText("Критичний");
});
