import type { Page } from "@playwright/test";

export async function mockMapTiles(page: Page) {
  await page.route(/https:\/\/(?:[abc]\.)?tile\.openstreetmap\.org\//, route => route.fulfill({
    contentType: "image/svg+xml", headers: { "access-control-allow-origin": "*" },
    body: '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e4ecdc"/><path d="M0 120H256M120 0V256" stroke="#fff" stroke-width="18"/><path d="M0 120H256M120 0V256" stroke="#d3b488" stroke-width="2"/><path d="M20 30L240 210" stroke="#a2d7ee" stroke-width="14"/></svg>'
  }));
}
