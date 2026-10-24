import { expect, test } from "@playwright/test";

test("rejects duplicate exposures visibly and preserves the current project", async ({ page }) => {
  const exposure = { objectId: "object", agentId: "agent-pm10", concentration: 0.1 };
  const project = {
    schema_version: 1,
    project: {
      title: "Imported project",
      agents: [{
        id: "agent-pm10", name: "Test PM10", cas: "", selected: true, source: "manual",
        dangerClass: 0, rfcLifelong: 0.05, rfcAcute: 0.15, sfi: 0,
        affectedOrgansLifelong: ["органи дихання"], affectedOrgansAcute: ["органи дихання"]
      }]
    },
    research: {
      points: [{ id: "object", title: "Test", population: 10000, deaths: 100 }],
      exposures: [exposure, { ...exposure }]
    }
  };
  const upload = () => ({ name: "project.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });

  await page.goto("/");
  await expect(page.locator(".title-input")).toHaveValue("Нове дослідження");
  await page.getByRole("button", { name: /Налаштування/ }).click();
  await page.locator('input[type="file"]').setInputFiles(upload());
  await expect(page.getByRole("alert")).toContainText("Повторний запис концентрації №2");
  await page.getByRole("button", { name: /^Проєкт$/ }).click();
  await expect(page.locator(".title-input")).toHaveValue("Нове дослідження");

  project.research.exposures = [exposure];
  await page.getByRole("button", { name: /Налаштування/ }).click();
  await page.locator('input[type="file"]').setInputFiles(upload());
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: /^Проєкт$/ }).click();
  await expect(page.locator(".title-input")).toHaveValue("Imported project");
  await page.getByRole("button", { name: /^Результати$/ }).click();
  await expect(page.getByRole("heading", { name: "Результати", exact: true })).toBeVisible();
});
