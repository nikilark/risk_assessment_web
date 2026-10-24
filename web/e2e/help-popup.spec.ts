import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-24T12:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-24T12:00:01Z"));
  await page.goto("/");
  await page.getByRole("button", { name: "Довідка", exact: true }).click();
});

test("help fades automatically and can be closed immediately", async ({ page }) => {
  const toast = page.getByRole("status");
  await expect(toast).toBeVisible();
  await expect(toast.getByRole("button", { name: "OK", exact: true })).toHaveCount(0);
  await page.clock.runFor(5999);
  await expect(toast).not.toHaveClass(/is-fading/);
  await page.clock.runFor(1);
  await expect(toast).toHaveClass(/is-fading/);
  await page.clock.runFor(250);
  await expect(toast).toHaveCount(0);
  await page.getByRole("button", { name: "Довідка", exact: true }).click();
  await toast.getByRole("button", { name: "Закрити повідомлення", exact: true }).click();
  await expect(toast).toHaveCount(0);
});

test("hover cancels fading and resets the countdown when the pointer leaves", async ({ page }) => {
  const toast = page.getByRole("status");
  await page.clock.runFor(6000);
  await expect(toast).toHaveClass(/is-fading/);
  await toast.hover();
  await expect(toast).not.toHaveClass(/is-fading/);
  await page.clock.runFor(10000);
  await expect(toast).toBeVisible();
  await page.mouse.move(0, 0);
  await page.clock.runFor(5999);
  await expect(toast).not.toHaveClass(/is-fading/);
  await page.clock.runFor(1);
  await expect(toast).toHaveClass(/is-fading/);
  await page.clock.runFor(250);
  await expect(toast).toHaveCount(0);
});

test("keyboard focus pauses dismissal and reopening the same help resets its timer", async ({ page }) => {
  const toast = page.getByRole("status");
  await page.clock.runFor(5000);
  await page.getByRole("button", { name: "Довідка", exact: true }).click();
  await page.clock.runFor(5000);
  await expect(toast).not.toHaveClass(/is-fading/);
  await toast.focus();
  await page.clock.runFor(10000);
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Закрити повідомлення", exact: true }).focus();
  await page.clock.runFor(10000);
  await expect(toast).toBeVisible();
  await page.getByRole("button", { name: "Довідка", exact: true }).focus();
  await page.clock.runFor(6250);
  await expect(toast).toHaveCount(0);
});
