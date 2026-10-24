import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("dark charts and exports remain readable, report charts stay light, and place filters have more room", async ({ page }) => {
  const project = {
    schema_version: 1,
    settings: { theme: "dark" },
    project: { title: "Theme regression", agents: [{ id: "agent-theme", name: "Test agent", cas: "", selected: true, source: "manual",
      dangerClass: 0, rfcLifelong: 0.05, rfcAcute: 0, sfi: 0, affectedOrgansLifelong: ["органи дихання"], affectedOrgansAcute: [] }] },
    research: { years: [2020, 2021],
      points: Array.from({ length: 14 }, (_, index) => ({ id: `point-${index}`, title: `Об'єкт ${index + 1}`, population: 1000, deaths: 10 })),
      exposures: [2020, 2021].flatMap((year) => Array.from({ length: 14 }, (_, index) => ({ objectId: `point-${index}`, agentId: "agent-theme", year, concentration: (index + 1) * (year === 2020 ? 0.01 : 0.02) }))) }
  };
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Налаштування", exact: true }).click();
  await page.locator('input[type="file"]').setInputFiles({ name: "theme.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(project)) });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");
  await expect(page.getByRole("button", { name: "Новий проєкт", exact: true })).toHaveCSS("color", "rgb(255, 180, 171)");
  await expect(page.locator(".color-preview span").nth(1)).toHaveCSS("color", "rgb(0, 0, 0)");
  await page.getByRole("button", { name: "Результати", exact: true }).click();
  await expect(page.locator(".result-header p")).toHaveCount(0);
  await expect(page.locator(".result-header")).not.toContainText("HQ =");
  const places = page.locator(".comparison-options-objectIds");
  expect(await places.evaluate((element) => element.clientHeight)).toBeGreaterThan(190);
  await expect(places.locator('input[type="checkbox"]')).toHaveCount(14);
  const chartSection = page.locator(".result-section").filter({ has: page.locator("summary", { hasText: /^Графік$/ }) });
  const canvas = chartSection.locator("canvas").first();
  await canvas.scrollIntoViewIfNeeded();
  await expect(canvas).toBeVisible();

  async function brightAxisPixels() {
    return canvas.evaluate((element: HTMLCanvasElement) => {
      const context = element.getContext("2d")!;
      const data = context.getImageData(0, Math.max(0, element.height - 155), element.width, 100).data;
      let count = 0;
      for (let index = 0; index < data.length; index += 4) {
        if (Math.abs(data[index] - 245) < 2 && Math.abs(data[index + 1] - 242) < 2 && Math.abs(data[index + 2] - 235) < 2 && data[index + 3] > 180) count++;
      }
      return count;
    });
  }
  await expect.poll(brightAxisPixels).toBeGreaterThan(20);
  await page.screenshot({ path: "/tmp/risk-dark-chart-contrast.png" });
  await page.evaluate(() => { document.documentElement.dataset.theme = "light"; });
  await expect.poll(brightAxisPixels).toBeLessThan(10);
  await page.evaluate(() => { document.documentElement.dataset.theme = "dark"; });
  await expect.poll(brightAxisPixels).toBeGreaterThan(20);

  const downloadPromise = page.waitForEvent("download");
  await chartSection.getByRole("button", { name: "PNG", exact: true }).click();
  const download = await downloadPromise;
  const png = (await readFile((await download.path())!)).toString("base64");
  const exported = await page.evaluate(async (base64) => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement("canvas"); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext("2d")!; context.drawImage(image, 0, 0);
    const background = [...context.getImageData(2, 2, 1, 1).data];
    const data = context.getImageData(0, image.height - 310, image.width, 300).data;
    let darkText = 0;
    for (let index = 0; index < data.length; index += 4) if (data[index] < 80 && data[index + 1] < 80 && data[index + 2] < 80 && data[index + 3] > 180) darkText++;
    return { background, darkText };
  }, png);
  expect(exported.background).toEqual([255, 255, 255, 255]);
  expect(exported.darkText).toBeGreaterThan(80);
  await expect.poll(brightAxisPixels).toBeGreaterThan(20);
  await chartSection.getByRole("button", { name: "До звіту", exact: true }).click();
  await page.getByRole("button", { name: "Звіт", exact: true }).click();
  await expect(page.locator(".report-sheet")).toHaveCSS("color-scheme", "light");
  await expect(page.locator(".report-sheet .chart-panel")).toHaveCSS("background-color", "rgb(255, 253, 248)");
  await expect(page.locator(".report-asset .muted")).toContainText("HQ = C / RfC");
  expect(errors).toEqual([]);
});
